import { it, expect, beforeAll, afterAll } from "vitest";
import { createServer, request, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { InstagramVault } from "../src/integrations/instagram/vault.js";
import { instagramConfig } from "../src/integrations/instagram/config.js";
import { InstagramOAuth } from "../src/integrations/instagram/oauth.js";
import { MetaHTTP } from "../src/integrations/instagram/http.js";
import { oauthHandler } from "../src/integrations/instagram/server.js";

const directory = mkdtempSync(resolve(".local/ig-oauth-test-"));
let server: Server, port: number;
const config = instagramConfig({
  INSTAGRAM_CLIENT_ID: "fixture-id",
  INSTAGRAM_CLIENT_SECRET: "fixture-secret",
  INSTAGRAM_API_VERSION: "v99.0",
});
const vault = new InstagramVault(directory, Buffer.alloc(32, 8));
const oauth = new InstagramOAuth(
  config,
  vault,
  new MetaHTTP(async () => {
    throw new Error("OAuth network must not be called in this HTTP/CSRF test");
  }),
);
beforeAll(async () => {
  server = createServer(
    oauthHandler(config, vault, oauth, undefined, "one-time-local-setup"),
  );
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as { port: number }).port;
});
afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  rmSync(directory, { recursive: true, force: true });
});
function localRequest(
  path: string,
  options: {
    cookie?: string;
    method?: string;
    origin?: string;
    body?: string;
    host?: string;
  } = {},
) {
  return new Promise<{
    status: number;
    headers: import("node:http").IncomingHttpHeaders;
    body: string;
  }>((resolve, reject) => {
    const req = request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: options.method ?? "GET",
        headers: {
          Host: options.host ?? "localhost:4318",
          ...(options.cookie ? { Cookie: options.cookie } : {}),
          ...(options.origin ? { Origin: options.origin } : {}),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => {
          body += c;
        });
        res.on("end", () =>
          resolve({ status: res.statusCode!, headers: res.headers, body }),
        );
      },
    );
    req.on("error", reject);
    req.end(options.body);
  });
}
it("OAuth endpoints reject anonymous setup, wrong Host, wrong browser state and CSRF disconnect", async () => {
  expect((await localRequest("/integrations/instagram/connect")).status).toBe(
    400,
  );
  expect(
    (
      await localRequest("/?setup=one-time-local-setup", {
        host: "attacker.example",
      })
    ).status,
  ).toBe(400);
  const setup = await localRequest("/?setup=one-time-local-setup");
  expect(setup.status).toBe(303);
  expect(setup.headers["set-cookie"]?.[0]).toContain(
    "HttpOnly; Secure; SameSite=Lax",
  );
  const cookie = setup.headers["set-cookie"]![0]!.split(";")[0]!;
  expect((await localRequest("/?setup=one-time-local-setup")).status).toBe(400);
  const connect = await localRequest("/integrations/instagram/connect", {
    cookie,
  });
  expect(connect.status).toBe(302);
  const state = new URL(connect.headers.location!).searchParams.get("state");
  expect(
    (
      await localRequest(
        `/integrations/instagram/callback?state=${state}&code=never-used`,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await localRequest(
        `/integrations/instagram/callback?state=${state}&code=never-used`,
        { cookie },
      )
    ).status,
  ).toBe(400);
  const denied = await localRequest("/integrations/instagram/connect", {
    cookie,
  });
  const deniedState = new URL(denied.headers.location!).searchParams.get(
    "state",
  );
  expect(
    (
      await localRequest(
        `/integrations/instagram/callback?state=${deniedState}&error=access_denied`,
        { cookie },
      )
    ).body,
  ).toContain("authorization_denied");
  expect(
    (
      await localRequest("/integrations/instagram/disconnect", {
        cookie,
        method: "POST",
        origin: "https://attacker.example",
        body: "csrf=wrong",
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await localRequest("/integrations/instagram/disconnect", {
        cookie,
        method: "POST",
        origin: "https://localhost:4318",
        body: "csrf=wrong",
      })
    ).status,
  ).toBe(400);
  expect(vault.connection({})).toBeUndefined();
});
