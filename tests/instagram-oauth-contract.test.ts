import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer, request } from "node:http";
import {
  instagramConfig,
  instagramScopes,
} from "../src/integrations/instagram/config.js";
import { InstagramVault } from "../src/integrations/instagram/vault.js";
import { InstagramOAuth } from "../src/integrations/instagram/oauth.js";
import {
  MetaHTTP,
  type HttpTransport,
} from "../src/integrations/instagram/http.js";
import {
  normalizeMeta,
  sanitizeMetaDiagnostic,
} from "../src/integrations/instagram/errors.js";
import { InstagramPublishingProvider } from "../src/integrations/instagram/provider.js";
import {
  instagramStatus,
  oauthHandler,
} from "../src/integrations/instagram/server.js";

const directory = mkdtempSync(resolve(".local/ig-contract-"));
const config = instagramConfig({
  INSTAGRAM_CLIENT_ID: "123456789",
  INSTAGRAM_CLIENT_SECRET: "fixture-secret+/=value",
  INSTAGRAM_API_VERSION: "v26.0",
  // Preserve the exact configured spelling, including hostname case.
  INSTAGRAM_REDIRECT_URI:
    "https://LOCALHOST:4318/integrations/instagram/callback",
  ENABLE_REAL_PUBLISHING: "false",
});
const code = "fixture-code+/%2F=single-use";
const shortToken = "fixture-short+/=token";
const longToken = "fixture-long+/=token";
const profile = {
  id: "999999", // App-scoped ID differs from the professional account ID.
  user_id: "17840000000000000",
  username: "poloconnect_fixture",
  account_type: "Business",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const logs = () =>
  vi
    .mocked(console.error)
    .mock.calls.map(([entry]) => JSON.parse(String(entry)));
let sequence = 0;
function fixture(
  options: {
    fail?: "code" | "long" | "identity";
    error?: unknown;
    status?: number;
    grants?: unknown;
    wrapped?: boolean;
  } = {},
) {
  const vault = new InstagramVault(
    join(directory, String(sequence++)),
    Buffer.alloc(32, 6),
  );
  const calls: { url: URL; init: RequestInit }[] = [];
  const transport: HttpTransport = vi.fn(async (url, init) => {
    const target = new URL(url);
    calls.push({ url: target, init });
    const token = {
      access_token: shortToken,
      user_id: "999999",
      permissions:
        "grants" in options ? options.grants : instagramScopes.join(","),
    };
    if (target.href === "https://api.instagram.com/oauth/access_token")
      return options.fail === "code"
        ? json(options.error, options.status ?? 400)
        : json(options.wrapped === false ? token : { data: [token] });
    if (
      target.origin === "https://graph.instagram.com" &&
      target.pathname === "/access_token"
    )
      return options.fail === "long"
        ? json(options.error, options.status ?? 400)
        : json({ access_token: longToken, expires_in: 5184000 });
    if (
      target.origin === "https://graph.instagram.com" &&
      target.pathname === "/v26.0/me"
    )
      return options.fail === "identity"
        ? json(options.error, options.status ?? 400)
        : json(options.wrapped === false ? profile : { data: [profile] });
    throw new Error("Unexpected endpoint in Instagram Login contract test");
  });
  const meta = new MetaHTTP(transport);
  return {
    vault,
    calls,
    meta,
    transport,
    oauth: new InstagramOAuth(config, vault, meta),
  };
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("Instagram Business Login official contract", () => {
  it.each([true, false])(
    "exchanges code, long token, identity and persists real grants (wrapped=%s)",
    async (wrapped) => {
      const f = fixture({ wrapped });
      const connection = await f.oauth.exchange(code + "#_");
      expect(f.calls).toHaveLength(3);
      const first = f.calls[0]!;
      expect(first.url.href).toBe(
        "https://api.instagram.com/oauth/access_token",
      );
      expect(first.init.method).toBe("POST");
      // Exercise actual fetch serialization, including its generated boundary.
      const serialized = new Request(first.url, first.init);
      expect(serialized.headers.get("Content-Type")).toMatch(
        /^multipart\/form-data; boundary=/,
      );
      expect(serialized.headers.has("Authorization")).toBe(false);
      expect(Object.fromEntries(await serialized.formData())).toEqual({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        redirect_uri: config.redirectURI,
        code,
      });
      const authorize = new URL(f.oauth.authorizeURL("state"));
      expect(authorize.searchParams.get("redirect_uri")).toBe(
        config.redirectURI,
      );
      expect(authorize.searchParams.get("scope")).toBe(
        instagramScopes.join(","),
      );
      const second = f.calls[1]!;
      expect(second.init.method).toBe("GET");
      expect(Object.fromEntries(second.url.searchParams)).toEqual({
        grant_type: "ig_exchange_token",
        client_secret: config.clientSecret,
        access_token: shortToken,
      });
      const third = f.calls[2]!;
      expect(third.init.method).toBe("GET");
      expect(third.url.pathname).toBe("/v26.0/me");
      expect(third.url.searchParams.get("fields")).toBe(
        "user_id,username,account_type",
      );
      expect(new Headers(third.init.headers).get("Authorization")).toBe(
        `Bearer ${longToken}`,
      );
      expect(connection).toMatchObject({
        accountId: profile.user_id,
        username: profile.username,
        accountType: "BUSINESS",
        accessToken: longToken,
        permissions: [...instagramScopes],
      });
      expect(
        Date.parse(connection.expiresAt!) - Date.parse(connection.obtainedAt),
      ).toBeCloseTo(5184000000, -2);
      expect(
        new InstagramVault(f.vault.directory, Buffer.alloc(32, 6)).connection(
          {},
        ),
      ).toEqual(connection);
      const bytes = readFileSync(join(f.vault.directory, "connection.enc"));
      expect(bytes.includes(Buffer.from(longToken))).toBe(false);
      expect(bytes.includes(Buffer.from(shortToken))).toBe(false);
      expect(logs().map((entry) => [entry.event, entry.result])).toEqual([
        ["instagram_oauth.exchange_code", "OK"],
        ["instagram_oauth.exchange_long_lived", "OK"],
        ["instagram_oauth.fetch_identity", "OK"],
        ["instagram_oauth.validate_permissions", "OK"],
        ["instagram_oauth.persist_vault", "OK"],
      ]);
      // The same saved connection must also pass status with publishing disabled.
      const provider = new InstagramPublishingProvider(
        config,
        connection,
        f.meta,
      );
      const checkConnection = provider.checkConnection.bind(provider);
      vi.spyOn(
        InstagramPublishingProvider.prototype,
        "checkConnection",
      ).mockImplementation(checkConnection);
      expect(await instagramStatus(config, f.vault)).toMatchObject({
        connected: true,
        tokenConfigured: true,
        accountId: profile.user_id,
        username: profile.username,
        tokenStatus: "valid",
        realPublishingEnabled: false,
      });
      expect(f.calls).toHaveLength(4);
      expect(
        f.calls.every((call) => !call.url.pathname.endsWith("/permissions")),
      ).toBe(true);
    },
  );

  it.each([
    ["code", "exchange_code", 1],
    ["long", "exchange_long_lived", 2],
    ["identity", "fetch_identity", 3],
  ] as const)(
    "reports %s failure and never writes partial credentials",
    async (fail, stage, requests) => {
      const f = fixture({
        fail,
        error: {
          error: {
            type: "OAuthException",
            code: 100,
            error_subcode: 33,
            message: "Unsupported request",
          },
        },
      });
      const write = vi.spyOn(f.vault, "write");
      await expect(f.oauth.exchange(code)).rejects.toMatchObject({
        code: "meta_api_error",
      });
      expect(f.calls).toHaveLength(requests);
      expect(write).not.toHaveBeenCalled();
      expect(f.vault.connection({})).toBeUndefined();
      expect(logs().at(-1)).toEqual({
        event: `instagram_oauth.${stage}`,
        result: "FAILED",
        provider: "instagram",
        error_code: "meta_api_error",
        http_status: 400,
        meta_error_type: "OAuthException",
        meta_error_code: 100,
        meta_error_subcode: 33,
        meta_error_message: "Unsupported request",
      });
      expect(
        logs()
          .slice(0, -1)
          .every((entry) => entry.result === "OK"),
      ).toBe(true);
    },
  );

  it.each([
    undefined,
    "instagram_business_basic",
    [],
    "business_basic,business_content_publish",
  ])(
    "rejects missing or old grants without assuming the requested scopes: %s",
    async (grants) => {
      const f = fixture({ grants });
      await expect(f.oauth.exchange(code)).rejects.toMatchObject({
        code: "missing_permission",
      });
      expect(f.vault.connection({})).toBeUndefined();
      expect(logs().at(-1)).toMatchObject({
        event: "instagram_oauth.validate_permissions",
        result: "FAILED",
      });
    },
  );

  it("reports vault failure without logging filesystem exceptions or claiming persistence succeeded", async () => {
    const f = fixture();
    vi.spyOn(f.vault, "write").mockImplementation(() => {
      throw new Error(`disk failure ${longToken}`);
    });
    await expect(f.oauth.exchange(code)).rejects.toMatchObject({
      code: "meta_api_error",
    });
    expect(logs().at(-1)).toEqual({
      event: "instagram_oauth.persist_vault",
      result: "FAILED",
      provider: "instagram",
      error_code: "oauth_request_failed",
    });
    expect(JSON.stringify(logs())).not.toContain(longToken);
  });

  it("status still rejects missing grants, mismatched identity and non-professional profiles", async () => {
    const f = fixture();
    const connection = await f.oauth.exchange(code);
    for (const changed of [
      { ...connection, permissions: ["instagram_business_basic"] },
      { ...connection, accountId: "111" },
    ]) {
      await expect(
        new InstagramPublishingProvider(
          config,
          changed,
          f.meta,
        ).checkConnection(),
      ).rejects.toMatchObject({ code: "missing_permission" });
    }
    const meta = new MetaHTTP(async () =>
      json({ ...profile, account_type: "PERSONAL" }),
    );
    await expect(
      new InstagramPublishingProvider(
        config,
        connection,
        meta,
      ).checkConnection(),
    ).rejects.toMatchObject({ code: "missing_permission" });
  });

  it("refreshes valid tokens older than 24h at the Instagram endpoint and preserves identity and grants", async () => {
    const f = fixture();
    const connection = await f.oauth.exchange(code);
    f.vault.write({
      connection: {
        ...connection,
        obtainedAt: new Date(Date.now() - 86401000).toISOString(),
      },
      disconnected: false,
    });
    const transport = vi.fn<HttpTransport>(async (url, init) => {
      const target = new URL(url);
      expect(target.origin + target.pathname).toBe(
        "https://graph.instagram.com/refresh_access_token",
      );
      expect(init.method).toBe("GET");
      expect(Object.fromEntries(target.searchParams)).toEqual({
        grant_type: "ig_refresh_token",
        access_token: longToken,
      });
      return json({
        access_token: "refreshed-fixture-token",
        expires_in: 5184000,
      });
    });
    const oauth = new InstagramOAuth(config, f.vault, new MetaHTTP(transport));
    await oauth.refresh();
    expect(f.vault.connection({})).toMatchObject({
      accountId: profile.user_id,
      permissions: [...instagramScopes],
      accessToken: "refreshed-fixture-token",
    });
    await expect(oauth.refresh()).rejects.toThrow("24 hours");
    expect(transport).toHaveBeenCalledTimes(1);
    const stored = f.vault.connection({})!;
    f.vault.write({
      connection: {
        ...stored,
        obtainedAt: "2020-01-01T00:00:00Z",
        expiresAt: "2020-01-02T00:00:00Z",
      },
      disconnected: false,
    });
    await expect(oauth.refresh()).rejects.toMatchObject({
      code: "expired_token",
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    "callback decodes once, preserves redirect and returns a safe response (failure=%s)",
    async (failure) => {
      const f = fixture(
        failure
          ? {
              fail: "code",
              error: {
                error_type: "OAuthException",
                code: 400,
                error_message: `Rejected ${code} ${config.clientSecret}`,
              },
            }
          : {},
      );
      const server = createServer(
        oauthHandler(config, f.vault, f.oauth, undefined, "fixture-setup"),
      );
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
      const port = (server.address() as { port: number }).port;
      const call = (path: string, cookie = "") =>
        new Promise<{
          status: number;
          headers: import("node:http").IncomingHttpHeaders;
          body: string;
        }>((resolve, reject) => {
          const req = request(
            {
              hostname: "127.0.0.1",
              port,
              path,
              headers: { Host: "localhost:4318", Cookie: cookie },
            },
            (res) => {
              let body = "";
              res.on("data", (chunk) => {
                body += chunk;
              });
              res.on("end", () =>
                resolve({
                  status: res.statusCode!,
                  headers: res.headers,
                  body,
                }),
              );
            },
          );
          req.on("error", reject);
          req.end();
        });
      try {
        const setup = await call("/?setup=fixture-setup");
        const cookie = setup.headers["set-cookie"]![0]!.split(";")[0]!;
        const connect = await call("/integrations/instagram/connect", cookie);
        const state = new URL(connect.headers.location!).searchParams.get(
          "state",
        )!;
        const path =
          "/integrations/instagram/callback?" +
          new URLSearchParams({ state, code: code + "#_" });
        const callback = await call(path, cookie);
        expect(callback.status).toBe(failure ? 400 : 200);
        if (failure)
          expect(JSON.parse(callback.body)).toEqual({
            error: "meta_api_error",
          });
        else
          expect(JSON.parse(callback.body)).toMatchObject({
            connected: true,
            accountId: profile.user_id,
            username: profile.username,
          });
        for (const secret of [code, shortToken, longToken, config.clientSecret])
          expect(callback.body).not.toContain(secret);
        expect((f.calls[0]!.init.body as FormData).get("code")).toBe(code);
        expect((f.calls[0]!.init.body as FormData).get("redirect_uri")).toBe(
          config.redirectURI,
        );
        expect((await call(path, cookie)).status).toBe(400);
        expect(f.calls).toHaveLength(failure ? 1 : 3);
      } finally {
        await new Promise<void>((r) => server.close(() => r()));
      }
    },
  );
});

describe("safe OAuth development diagnostics", () => {
  it.each(["code", "long", "identity"] as const)(
    "sanitizes %s errors, including echoed credentials and encoded secrets",
    async (fail) => {
      const sensitive = [code, config.clientSecret, shortToken, longToken];
      const message =
        "Rejected request " +
        sensitive
          .flatMap((s) => [
            s,
            encodeURIComponent(s),
            encodeURIComponent(encodeURIComponent(s)),
          ])
          .join(" ") +
        " https://example.invalid/callback?code=unrelated-code&access_token=unrelated-token" +
        " Authorization: Bearer unrelated-bearer refresh_token=unrelated-refresh\nspoofed";
      const f = fixture({
        fail,
        error: {
          error_type: "OAuthException",
          code: 400,
          error_message: message,
          access_token: "raw-response-token",
          client_secret: "raw-response-secret",
          headers: { Authorization: "raw-response-authorization" },
          credentials: { access_token: shortToken, refresh_token: longToken },
        },
      });
      await expect(f.oauth.exchange(code)).rejects.toMatchObject({
        code: "meta_api_error",
      });
      const text = JSON.stringify(logs());
      for (const secret of [
        ...sensitive.flatMap((s) => [
          s,
          encodeURIComponent(s),
          encodeURIComponent(encodeURIComponent(s)),
        ]),
        "unrelated-code",
        "unrelated-token",
        "unrelated-bearer",
        "unrelated-refresh",
        "raw-response-token",
        "raw-response-secret",
        "raw-response-authorization",
      ])
        expect(text).not.toContain(secret);
      expect(logs().at(-1)).toMatchObject({
        http_status: 400,
        meta_error_type: "OAuthException",
        meta_error_code: 400,
      });
      expect(text).not.toContain("https://");
      expect(text).not.toContain("\\n");
    },
  );

  it("allowlists metadata and keeps provider text out of serialized browser errors", () => {
    const error = normalizeMeta(
      400,
      {
        error: {
          type: "OAuthException",
          code: 100,
          message: `bad client_secret="unknown secret with spaces" ${config.clientSecret}`,
        },
      },
      [config.clientSecret],
    );
    expect(error.diagnostic?.meta_error_message).toBe(
      "bad client_secret=[REDACTED] [REDACTED]",
    );
    expect(JSON.stringify(error)).not.toContain("meta_error_message");
    expect(JSON.stringify(error)).not.toContain("unknown secret");
    expect(sanitizeMetaDiagnostic(502, null)).toEqual({ http_status: 502 });
  });

  it("never logs arbitrary transport exceptions or malformed provider bodies", async () => {
    for (const transport of [
      async () => {
        throw new Error(
          `https://example.invalid/?code=${code} Bearer ${longToken}`,
        );
      },
      async () =>
        new Response(`<html>${code} ${longToken}</html>`, { status: 502 }),
      async () => json(null),
    ]) {
      const f = fixture();
      await expect(
        new InstagramOAuth(config, f.vault, new MetaHTTP(transport)).exchange(
          code,
        ),
      ).rejects.toThrow();
    }
    const text = JSON.stringify(logs());
    expect(text).not.toContain(code);
    expect(text).not.toContain(longToken);
    expect(text).not.toContain("https://");
    expect(logs()).toContainEqual(
      expect.objectContaining({ http_status: 502, result: "FAILED" }),
    );
  });

  it("disables development diagnostics in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await fixture().oauth.exchange(code);
    expect(console.error).not.toHaveBeenCalled();
  });
});
