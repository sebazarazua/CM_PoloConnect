import {
  createServer as createHTTPServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createServer as createHTTPSServer } from "node:https";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { ensure } from "../../common/core.js";
import { InstagramOAuth, OAuthStates } from "./oauth.js";
import { InstagramVault } from "./vault.js";
import { InstagramPublishingProvider } from "./provider.js";
import { InstagramError } from "./errors.js";
import type { InstagramConfig } from "./config.js";

export async function instagramStatus(
  config: InstagramConfig,
  vault: InstagramVault,
  remote = true,
) {
  const connection = vault.connection();
  const base = {
    redirectURI: config.redirectURI,
    apiVersion: config.apiVersion || "not_configured",
    realPublishingEnabled: config.enabled,
    tokenConfigured: !!connection,
    tokenExpiresAt: connection?.expiresAt ?? null,
    accountId: connection?.accountId ?? null,
    username: connection?.username ?? null,
    connected: false,
    tokenStatus: connection ? "not_checked" : "missing",
    error: null as string | null,
  };
  if (!connection) return base;
  if (
    connection.expiresAt &&
    (!Number.isFinite(Date.parse(connection.expiresAt)) ||
      Date.parse(connection.expiresAt) <= Date.now())
  )
    return { ...base, tokenStatus: "expired", error: "expired_token" };
  if (!config.apiVersion || !remote) return base;
  try {
    const profile = await new InstagramPublishingProvider(
      config,
      connection,
    ).checkConnection();
    return { ...base, ...profile, connected: true, tokenStatus: "valid" };
  } catch (error) {
    return {
      ...base,
      tokenStatus: "invalid_or_unavailable",
      error:
        error instanceof InstagramError ? error.code : "configuration_error",
    };
  }
}
export function localTLS(config: InstagramConfig, vault: InstagramVault) {
  ensure(config.redirectURI.startsWith("https://"), "TLS requires HTTPS");
  vault.initialize();
  const key =
      process.env.INSTAGRAM_TLS_KEY_FILE ||
      join(vault.directory, "localhost-key.pem"),
    cert =
      process.env.INSTAGRAM_TLS_CERT_FILE ||
      join(vault.directory, "localhost-cert.pem");
  if (!existsSync(key) || !existsSync(cert)) {
    ensure(
      !process.env.INSTAGRAM_TLS_KEY_FILE &&
        !process.env.INSTAGRAM_TLS_CERT_FILE,
      "Configured TLS certificate or key is missing",
    );
    const executable =
      process.env.OPENSSL_BIN ||
      (process.platform === "win32" &&
      existsSync("C:/Program Files/Git/usr/bin/openssl.exe")
        ? "C:/Program Files/Git/usr/bin/openssl.exe"
        : "openssl");
    try {
      execFileSync(
        executable,
        [
          "req",
          "-x509",
          "-newkey",
          "rsa:2048",
          "-noenc",
          "-keyout",
          resolve(key),
          "-out",
          resolve(cert),
          "-days",
          "30",
          "-subj",
          "/CN=localhost",
          "-addext",
          "subjectAltName=DNS:localhost,IP:127.0.0.1",
        ],
        { stdio: "ignore", windowsHide: true, timeout: 30_000 },
      );
    } catch {
      throw new Error(
        "Local HTTPS needs OpenSSL or INSTAGRAM_TLS_KEY_FILE / INSTAGRAM_TLS_CERT_FILE. Alternatively set INSTAGRAM_PROXY_MODE=true behind your HTTPS tunnel.",
      );
    }
  }
  return { key: readFileSync(key), cert: readFileSync(cert) };
}
export function oauthHandler(
  config: InstagramConfig,
  vault: InstagramVault,
  oauth = new InstagramOAuth(config, vault),
  states = new OAuthStates(),
  setupKey = randomBytes(32).toString("hex"),
) {
  const origin = new URL(config.redirectURI).origin;
  let setupAvailable = true;
  const sessions = new Map<string, number>();
  return async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    );
    const send = (status: number, value: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(value));
    };
    try {
      // Ignore forwarded Host headers; only the explicitly configured origin is accepted.
      ensure(
        req.headers.host === new URL(config.redirectURI).host ||
          req.headers.host === `localhost:${config.port}` ||
          req.headers.host === `127.0.0.1:${config.port}`,
        "Unexpected OAuth host",
      );
      const url = new URL(req.url ?? "/", origin),
        cookies = Object.fromEntries(
          (req.headers.cookie ?? "")
            .split(";")
            .map((c) => c.trim().split("="))
            .filter((c) => c.length === 2),
        );
      const session = cookies.pc_ig_session || "";
      const cookie = (value: string) =>
        res.setHeader(
          "Set-Cookie",
          `pc_ig_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
        );
      if (req.method === "GET" && url.pathname === "/") {
        const csrf = session;
        if (setupAvailable && url.searchParams.get("setup") === setupKey) {
          setupAvailable = false;
          const fresh = randomBytes(32).toString("hex");
          sessions.set(fresh, Date.now() + 600_000);
          cookie(fresh);
          res.writeHead(303, { Location: "/" });
          res.end();
          return;
        }
        ensure(
          (sessions.get(session) ?? 0) > Date.now(),
          "Open the one-time setup link printed by the local CLI",
        );
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          `<!doctype html><html lang="es"><meta charset="utf-8"><title>Polo Connect / Instagram</title><h1>Polo Connect · Instagram</h1><p>Esta conexión no publica contenido.</p><p><a href="/integrations/instagram/connect">Conectar Instagram</a> · <a href="/integrations/instagram/status">Estado</a></p><form method="post" action="/integrations/instagram/disconnect"><input type="hidden" name="csrf" value="${csrf}"><button>Desconectar y revocar acceso</button></form></html>`,
        );
        return;
      }
      if (
        req.method === "GET" &&
        url.pathname === "/integrations/instagram/connect"
      ) {
        ensure(
          (sessions.get(session) ?? 0) > Date.now(),
          "Authorized local setup session required",
        );
        const state = states.issue(session);
        res.writeHead(302, { Location: oauth.authorizeURL(state) });
        res.end();
        return;
      }
      if (
        req.method === "GET" &&
        url.pathname === "/integrations/instagram/callback"
      ) {
        states.consume(url.searchParams.get("state") ?? "", session);
        if (url.searchParams.has("error")) {
          send(400, { connected: false, error: "authorization_denied" });
          return;
        }
        const connection = await oauth.exchange(
          url.searchParams.get("code") ?? "",
        );
        send(200, {
          connected: true,
          accountId: connection.accountId,
          username: connection.username,
          expiresAt: connection.expiresAt,
          publishing: "manual CLI only",
        });
        return;
      }
      if (
        req.method === "GET" &&
        url.pathname === "/integrations/instagram/status"
      ) {
        ensure(
          (sessions.get(session) ?? 0) > Date.now(),
          "Authorized local setup session required",
        );
        send(200, await instagramStatus(config, vault));
        return;
      }
      if (
        req.method === "POST" &&
        url.pathname === "/integrations/instagram/disconnect"
      ) {
        ensure(
          req.headers.origin === origin &&
            (sessions.get(session) ?? 0) > Date.now(),
          "Disconnect requires a same-origin browser session",
        );
        let body = "";
        for await (const chunk of req) {
          body += String(chunk);
          ensure(body.length < 2048, "Request too large");
        }
        ensure(
          new URLSearchParams(body).get("csrf") === session,
          "Invalid disconnect CSRF token",
        );
        await oauth.disconnect();
        sessions.delete(session);
        cookie("");
        send(200, { connected: false, revoked: true });
        return;
      }
      send(404, { error: "not_found" });
    } catch (error) {
      send(400, {
        error:
          error instanceof InstagramError ? error.code : "oauth_request_failed",
      });
    }
  };
}
export async function startInstagramServer(
  config: InstagramConfig,
  vault: InstagramVault,
) {
  ensure(
    config.clientId && config.clientSecret && config.apiVersion,
    "Set Instagram credentials and API version before starting OAuth",
  );
  const setupKey = randomBytes(32).toString("hex");
  const handler = oauthHandler(config, vault, undefined, undefined, setupKey);
  const proxy = process.env.INSTAGRAM_PROXY_MODE === "true";
  if (proxy)
    ensure(
      new URL(config.redirectURI).hostname !== "localhost",
      "Proxy mode needs the public HTTPS redirect URI of your tunnel",
    );
  const server = proxy
    ? createHTTPServer(handler)
    : createHTTPSServer(localTLS(config, vault), handler);
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, "127.0.0.1", () => resolve());
  });
  return { server, setupKey };
}
