import { randomBytes, timingSafeEqual } from "node:crypto";
import { ensure } from "../../common/core.js";
import {
  instagramScopes,
  requireVersion,
  type InstagramConfig,
} from "./config.js";
import { MetaHTTP, instagramObject } from "./http.js";
import { InstagramVault, type InstagramConnection } from "./vault.js";
import { InstagramError, sanitizeMetaDiagnostic } from "./errors.js";

type OAuthStage =
  | "exchange_code"
  | "exchange_long_lived"
  | "fetch_identity"
  | "validate_permissions"
  | "persist_vault"
  | "refresh_token";

export class OAuthStates {
  private states = new Map<string, { sessionHash: string; expires: number }>();
  constructor(private clock = Date.now) {}
  issue(session: string): string {
    for (const [k, v] of this.states)
      if (v.expires < this.clock()) this.states.delete(k);
    ensure(this.states.size < 100, "Too many pending OAuth requests");
    const state = randomBytes(32).toString("hex");
    this.states.set(state, {
      sessionHash: session,
      expires: this.clock() + 600_000,
    });
    return state;
  }
  consume(state: string, session: string): void {
    const pending = this.states.get(state);
    this.states.delete(state);
    ensure(
      pending &&
        pending.expires > this.clock() &&
        !!session &&
        session.length === pending.sessionHash.length &&
        timingSafeEqual(Buffer.from(session), Buffer.from(pending.sessionHash)),
      "Invalid, expired or replayed OAuth state",
    );
  }
}
export class InstagramOAuth {
  constructor(
    private config: InstagramConfig,
    private vault: InstagramVault,
    private meta = new MetaHTTP(),
  ) {}
  private async stage<T>(
    stage: OAuthStage,
    secrets: readonly string[],
    action: () => T | Promise<T>,
  ): Promise<T> {
    const log = (result: "OK" | "FAILED", error?: unknown) => {
      if (process.env.NODE_ENV === "production") return;
      const diagnostic =
        error instanceof InstagramError ? error.diagnostic : undefined;
      console.error(
        JSON.stringify({
          event: `instagram_oauth.${stage}`,
          result,
          provider: "instagram",
          ...(error
            ? {
                error_code:
                  error instanceof InstagramError
                    ? error.code
                    : "oauth_request_failed",
              }
            : {}),
          ...(diagnostic
            ? sanitizeMetaDiagnostic(
                diagnostic.http_status,
                diagnostic,
                secrets,
              )
            : {}),
        }),
      );
    };
    try {
      const value = await action();
      log("OK");
      return value;
    } catch (error) {
      log("FAILED", error);
      // Callers (including the refresh CLI) must not print arbitrary exception
      // messages that could contain credentials or request details.
      throw error instanceof InstagramError
        ? error
        : new InstagramError("meta_api_error");
    }
  }
  authorizeURL(state: string): string {
    ensure(
      this.config.clientId && this.config.clientSecret,
      "Set Instagram App ID and Instagram App Secret before connecting",
    );
    requireVersion(this.config);
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectURI,
      response_type: "code",
      scope: instagramScopes.join(","),
      state,
      enable_fb_login: "false",
      force_reauth: "true",
    }).toString();
    return url.href;
  }
  async exchange(code: string): Promise<InstagramConnection> {
    // URLSearchParams in the callback already decodes once. The documented
    // trailing fragment is not part of the code; never decode the code again.
    const authorizationCode = code.replace(/#_$/, "");
    const secrets = [code, authorizationCode, this.config.clientSecret];
    const short = await this.stage("exchange_code", secrets, async () => {
      ensure(
        authorizationCode && authorizationCode.length < 4096,
        "Missing OAuth authorization code",
      );
      const response = await this.meta.request(
        "https://api.instagram.com/oauth/access_token",
        "POST",
        {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectURI,
          grant_type: "authorization_code",
          code: authorizationCode,
        },
        undefined,
        secrets,
      );
      const token = instagramObject(response);
      if (
        typeof token.access_token !== "string" ||
        !token.access_token ||
        !/^\d+$/.test(String(token.user_id))
      )
        throw new InstagramError("meta_api_error");
      return {
        access_token: token.access_token,
        permissions: token.permissions,
      };
    });
    secrets.push(short.access_token);
    const long = await this.stage("exchange_long_lived", secrets, async () => {
      const token = await this.meta.request(
        "https://graph.instagram.com/access_token",
        "GET",
        {
          grant_type: "ig_exchange_token",
          client_secret: this.config.clientSecret,
          access_token: short.access_token,
        },
        undefined,
        secrets,
      );
      if (
        typeof token.access_token !== "string" ||
        !token.access_token ||
        !Number.isFinite(Number(token.expires_in)) ||
        Number(token.expires_in) <= 0
      )
        throw new InstagramError("meta_api_error");
      return {
        access_token: token.access_token,
        expires_in: Number(token.expires_in),
      };
    });
    secrets.push(long.access_token);
    const me = await this.stage("fetch_identity", secrets, async () => {
      const profile = instagramObject(
        await this.meta.request(
          `https://graph.instagram.com/${requireVersion(this.config)}/me`,
          "GET",
          { fields: "user_id,username,account_type" },
          long.access_token,
          secrets,
        ),
      );
      if (
        !/^\d+$/.test(String(profile.user_id)) ||
        typeof profile.username !== "string" ||
        !profile.username
      )
        throw new InstagramError("meta_api_error");
      if (
        !["BUSINESS", "MEDIA_CREATOR", "CREATOR"].includes(
          String(profile.account_type).toUpperCase(),
        )
      )
        throw new InstagramError("missing_permission");
      return profile;
    });
    const accountId = String(me.user_id);
    const permissions = await this.stage(
      "validate_permissions",
      secrets,
      () => {
        // Business Login returns the actual grants in the token response. The
        // professional user node has no documented GET /permissions edge.
        const granted: unknown = short.permissions;
        const permissions =
          typeof granted === "string"
            ? granted.split(",").map((p) => p.trim())
            : Array.isArray(granted)
              ? granted.filter((p): p is string => typeof p === "string")
              : [];
        if (!instagramScopes.every((p) => permissions.includes(p)))
          throw new InstagramError("missing_permission");
        return permissions;
      },
    );
    const connection: InstagramConnection = {
      accountId,
      username: String(me.username ?? ""),
      accountType: String(me.account_type ?? "").toUpperCase(),
      accessToken: long.access_token,
      expiresAt: new Date(
        Date.now() + Number(long.expires_in) * 1000,
      ).toISOString(),
      obtainedAt: new Date().toISOString(),
      permissions,
    };
    await this.stage("persist_vault", secrets, () =>
      this.vault.write({ connection, disconnected: false }),
    );
    return connection;
  }
  async disconnect(): Promise<void> {
    const connection = this.vault.connection();
    // Keep the credential if revocation fails, so an operator can retry it.
    if (connection)
      await this.meta.request(
        `https://graph.instagram.com/${requireVersion(this.config)}/${connection.accountId}/permissions`,
        "DELETE",
        {},
        connection.accessToken,
      );
    this.vault.write({ connection: null, disconnected: true });
  }
  async refresh(): Promise<void> {
    const connection = this.vault.connection();
    ensure(connection, "Instagram is not connected");
    ensure(
      connection.obtainedAt &&
        Date.now() - Date.parse(connection.obtainedAt) >= 86_400_000,
      "Long-lived token must be at least 24 hours old before refresh",
    );
    if (connection.expiresAt && Date.parse(connection.expiresAt) <= Date.now())
      throw new InstagramError("expired_token");
    const secrets = [this.config.clientSecret, connection.accessToken];
    const data = await this.stage("refresh_token", secrets, async () => {
      const token = await this.meta.request(
        "https://graph.instagram.com/refresh_access_token",
        "GET",
        {
          grant_type: "ig_refresh_token",
          access_token: connection.accessToken,
        },
        undefined,
        secrets,
      );
      if (
        typeof token.access_token !== "string" ||
        !token.access_token ||
        !Number.isFinite(Number(token.expires_in)) ||
        Number(token.expires_in) <= 0
      )
        throw new InstagramError("meta_api_error");
      return {
        access_token: token.access_token,
        expires_in: Number(token.expires_in),
      };
    });
    secrets.push(data.access_token);
    await this.stage("persist_vault", secrets, () =>
      this.vault.write({
        connection: {
          ...connection,
          accessToken: data.access_token,
          obtainedAt: new Date().toISOString(),
          expiresAt: new Date(
            Date.now() + Number(data.expires_in) * 1000,
          ).toISOString(),
        },
        disconnected: false,
      }),
    );
  }
}
