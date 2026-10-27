import { randomBytes, timingSafeEqual } from "node:crypto";
import { ensure } from "../../common/core.js";
import {
  instagramScopes,
  requireVersion,
  type InstagramConfig,
} from "./config.js";
import { MetaHTTP, instagramObject } from "./http.js";
import { InstagramVault, type InstagramConnection } from "./vault.js";
import { InstagramError } from "./errors.js";

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
    ensure(code && code.length < 4096, "Missing OAuth authorization code");
    const response = await this.meta.request(
      "https://api.instagram.com/oauth/access_token",
      "POST",
      {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectURI,
        grant_type: "authorization_code",
        code,
      },
    );
    const short = (
      Array.isArray(response.data) ? response.data[0] : response
    ) as Record<string, unknown>;
    ensure(
      typeof short?.access_token === "string" &&
        /^\d+$/.test(String(short.user_id)),
      "Invalid Instagram token response",
    );
    const long = await this.meta.request(
      "https://graph.instagram.com/access_token",
      "GET",
      {
        grant_type: "ig_exchange_token",
        client_secret: this.config.clientSecret,
        access_token: short.access_token,
      },
    );
    ensure(
      typeof long.access_token === "string" && Number(long.expires_in) > 0,
      "Invalid long-lived token response",
    );
    const me = instagramObject(
      await this.meta.request(
        `https://graph.instagram.com/${requireVersion(this.config)}/me`,
        "GET",
        { fields: "user_id,username,account_type" },
        long.access_token,
      ),
    );
    ensure(/^\d+$/.test(String(me.user_id)), "Instagram profile ID missing");
    const accountId = String(me.user_id);
    const granted = await this.meta.request(
      `https://graph.instagram.com/${this.config.apiVersion}/${accountId}/permissions`,
      "GET",
      {},
      long.access_token,
    );
    const permissions = (Array.isArray(granted.data) ? granted.data : [])
      .filter((p: { status?: string }) => p.status === "granted")
      .map((p: { permission?: string }) => String(p.permission));
    if (!instagramScopes.every((p) => permissions.includes(p)))
      throw new InstagramError("missing_permission");
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
    this.vault.write({ connection, disconnected: false });
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
    const data = await this.meta.request(
      "https://graph.instagram.com/refresh_access_token",
      "GET",
      { grant_type: "ig_refresh_token", access_token: connection.accessToken },
    );
    ensure(
      typeof data.access_token === "string" && Number(data.expires_in) > 0,
      "Invalid refresh response",
    );
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
    });
  }
}

