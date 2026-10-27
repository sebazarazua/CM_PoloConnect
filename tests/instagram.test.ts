import { it, expect, describe, vi, beforeAll, afterAll } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { S3Client } from "@aws-sdk/client-s3";
import {
  instagramConfig,
  defaultRedirectURI,
} from "../src/integrations/instagram/config.js";
import {
  InstagramVault,
  type InstagramConnection,
} from "../src/integrations/instagram/vault.js";
import {
  OAuthStates,
  InstagramOAuth,
} from "../src/integrations/instagram/oauth.js";
import {
  MetaHTTP,
  type HttpTransport,
} from "../src/integrations/instagram/http.js";
import { InstagramPublishingProvider } from "../src/integrations/instagram/provider.js";
import {
  InstagramError,
  normalizeMeta,
} from "../src/integrations/instagram/errors.js";
import {
  S3MediaHostingProvider,
  LocalMockMediaHostingProvider,
  prepareImage,
  bytesHash,
  type PreparedMedia,
} from "../src/integrations/instagram/hosting.js";
import { InstagramPublicationService } from "../src/integrations/instagram/service.js";
import { buildPublicationPackage } from "../src/integrations/instagram/publication-package.js";
import { redact, hash, now } from "../src/common/core.js";
import {
  FileRepository,
  MemoryRepository,
  type EditorialRepository,
} from "../src/persistence/repository.js";
import { current, type Asset, type Store } from "../src/domain/models.js";
import { packageHash, pendingApproval } from "../src/approvals/service.js";
import { createCM, ready } from "./helpers.js";

const directory = mkdtempSync(resolve(".local/instagram-test-"));
const config = instagramConfig({
  INSTAGRAM_API_VERSION: "v99.0",
  ENABLE_REAL_PUBLISHING: "true",
  INSTAGRAM_CLIENT_ID: "fixture-client",
  INSTAGRAM_CLIENT_SECRET: "fixture-secret",
});
const connection: InstagramConnection = {
  accountId: "123",
  username: "fixture-account",
  accountType: "BUSINESS",
  accessToken: "fixture-credential",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  obtainedAt: now(),
  permissions: [
    "instagram_business_basic",
    "instagram_business_content_publish",
  ],
};
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function fakeHTTP(
  overrides: {
    failContainer?: boolean;
    expired?: boolean;
    publishLost?: boolean;
    progress?: boolean;
    permalinkFail?: boolean;
  } = {},
) {
  const calls: { url: string; init: RequestInit }[] = [];
  const transport: HttpTransport = async (url, init) => {
    calls.push({ url, init });
    const u = new URL(url);
    if (overrides.expired) return response({ error: { code: 190 } }, 400);
    if (u.pathname.endsWith("/permissions"))
      return response({
        data: connection.permissions.map((permission) => ({
          permission,
          status: "granted",
        })),
      });
    if (u.pathname.endsWith("/me"))
      return response({
        user_id: "123",
        username: "fixture-account",
        account_type: "BUSINESS",
      });
    if (u.pathname.endsWith("/media_publish")) {
      if (overrides.publishLost)
        throw new Error("Bearer credential from an untrusted transport");
      return response({ id: "900" });
    }
    if (u.pathname.endsWith("/media")) return response({ id: "800" });
    if (u.pathname.endsWith("/800"))
      return response({
        id: "800",
        status_code: overrides.failContainer
          ? "ERROR"
          : overrides.progress
            ? "IN_PROGRESS"
            : "FINISHED",
      });
    if (u.pathname.endsWith("/900"))
      return overrides.permalinkFail
        ? response({ error: { code: 4 } }, 429)
        : response({
            id: "900",
            permalink: "https://www.instagram.com/p/fixture/",
          });
    throw new Error("Unexpected fake HTTP request");
  };
  return {
    calls,
    transport,
    provider: new InstagramPublishingProvider(
      config,
      connection,
      new MetaHTTP(transport),
      { attempts: 2, intervalMs: 0 },
    ),
  };
}
let fixture: Store, contentId: string, render: Asset, prepared: PreparedMedia;
beforeAll(async () => {
  const repository = new MemoryRepository(),
    cm = createCM(repository),
    c = await ready(cm);
  contentId = c.id;
  const path = join(directory, "final.png");
  await sharp({
    create: { width: 1080, height: 1350, channels: 3, background: "#116dad" },
  })
    .png()
    .toFile(path);
  const sha256 = bytesHash(readFileSync(path));
  await repository.transaction(async (s) => {
    const item = s.contents[contentId]!;
    for (const a of current(item.assets)!.data) {
      a.storageRef = path;
      a.metadata = {
        actualMedia: true,
        sha256,
        width: 1080,
        height: 1350,
        surface: "feed",
        renderQA: { passed: true },
      };
      if (a.stage !== "rendered") a.type = "logo";
    }
    render = structuredClone(
      current(item.assets)!.data.find((a) => a.stage === "rendered")!,
    );
    current(item.metadata)!.data.instagramTarget = {
      accountId: "123",
      surface: "feed",
    };
    const review = current(item.reviews)!.data;
    review.simulated = false;
    review.scope.publishing_route = "instagram_api_with_instagram_login";
    const run = s.runs.findLast((r) => r.skill === "quality-reviewer")!;
    run.llmCall = true;
    run.provider = "fake-http-test";
    run.executor = "fake-http-test";
    run.output = structuredClone(review);
    run.input = {
      ...(run.input as object),
      visualAssets: [{ assetId: render.id, sha256: render.metadata.sha256 }],
    };
    item.approvals = [];
    pendingApproval(item);
  });
  await cm.approveContent(
    contentId,
    "human-test-fixture",
    packageHash((await repository.read()).contents[contentId]!),
  );
  fixture = await repository.read();
  prepared = await prepareImage(render, join(directory, "prepared"));
}, 30_000);
afterAll(() => rmSync(directory, { recursive: true, force: true }));
async function repo(state = fixture): Promise<MemoryRepository> {
  const r = new MemoryRepository();
  await r.transaction(async (s) => {
    Object.assign(s, structuredClone(state));
  });
  return r;
}
const service = (
  repository: EditorialRepository,
  provider: InstagramPublishingProvider,
  hosting = new LocalMockMediaHostingProvider(),
  enabled = true,
) =>
  new InstagramPublicationService(repository, provider, hosting, enabled, true);

describe("Instagram Login and transport", () => {
  it("uses current scope family, exact HTTPS redirect and explicit version configuration", () => {
    expect(instagramConfig({}).enabled).toBe(false);
    expect(instagramConfig({}).redirectURI).toBe(defaultRedirectURI);
    const vault = new InstagramVault(join(directory, "auth"), randomBytes(32));
    const url = new URL(new InstagramOAuth(config, vault).authorizeURL("csrf"));
    expect(url.hostname).toBe("www.instagram.com");
    expect(url.searchParams.get("scope")).toBe(
      connection.permissions.join(","),
    );
    expect(
      () => new InstagramPublishingProvider(instagramConfig({}), connection),
    ).toThrow("INSTAGRAM_API_VERSION");
    expect(() =>
      instagramConfig({
        INSTAGRAM_REDIRECT_URI:
          "http://localhost:4318/integrations/instagram/callback",
      }),
    ).toThrow("HTTPS");
  });
  it("OAuth state is browser bound, single-use and expires", () => {
    let clock = 100;
    const states = new OAuthStates(() => clock);
    const state = states.issue("browser");
    expect(() => states.consume(state, "attacker")).toThrow();
    expect(() => states.consume(state, "browser")).toThrow();
    const good = states.issue("browser");
    states.consume(good, "browser");
    expect(() => states.consume(good, "browser")).toThrow();
    const expired = states.issue("browser");
    clock += 600001;
    expect(() => states.consume(expired, "browser")).toThrow();
  });
  it("exchanges flat/wrapped tokens and persists only AES-GCM ciphertext with expiry", async () => {
    for (const wrapped of [true, false]) {
      const path = join(directory, `oauth-${wrapped}`),
        vault = new InstagramVault(path, Buffer.alloc(32, 7));
      const transport: HttpTransport = async (url) => {
        if (url.includes("api.instagram.com/oauth/access_token"))
          return response(
            wrapped
              ? {
                  data: [
                    { access_token: "short-fixture-value", user_id: "123" },
                  ],
                }
              : { access_token: "short-fixture-value", user_id: "123" },
          );
        if (url.includes("graph.instagram.com/access_token"))
          return response({
            access_token: "long-fixture-value",
            expires_in: 5184000,
          });
        if (url.includes("/permissions"))
          return response({
            data: connection.permissions.map((permission) => ({
              permission,
              status: "granted",
            })),
          });
        const profile = {
          user_id: "123",
          username: "test",
          account_type: "Business",
        };
        return response(wrapped ? { data: [profile] } : profile);
      };
      await new InstagramOAuth(config, vault, new MetaHTTP(transport)).exchange(
        "single-use-code",
      );
      expect(vault.connection({})?.accountId).toBe("123");
      expect(vault.connection({})?.accountType).toBe("BUSINESS");
      expect(Date.parse(vault.connection({})!.expiresAt!)).toBeGreaterThan(
        Date.now(),
      );
      expect(
        readFileSync(join(path, "connection.enc")).includes(
          Buffer.from("long-fixture-value"),
        ),
      ).toBe(false);
      vault.write({ connection: null, disconnected: true });
      expect(
        vault.connection({
          INSTAGRAM_ACCESS_TOKEN: "still-in-env",
          INSTAGRAM_USER_ID: "123",
        }),
      ).toBeUndefined();
    }
  });
  it("redacts nested tokens and complete signed URLs, retaining usage counters", () => {
    const text = JSON.stringify(
      redact({
        access_token: "private-value",
        clientSecret: "private-value",
        mediaURL: "https://bucket.example/x?X-Amz-Signature=private-value",
        message: "https://bucket.example/x?X-Amz-Credential=private-value",
        inputTokens: 42,
      }),
    );
    expect(text).not.toContain("private-value");
    expect(text).toContain('"inputTokens":42');
  });
  it("only calls official Instagram hosts and normalizes expired token, permissions and rate limits", async () => {
    const fake = fakeHTTP({ expired: true });
    await expect(fake.provider.checkConnection()).rejects.toMatchObject({
      code: "expired_token",
    });
    expect(normalizeMeta(403, { error: { code: 10 } }).code).toBe(
      "missing_permission",
    );
    expect(normalizeMeta(429, {}).retryable).toBe(true);
    await expect(
      new MetaHTTP(fake.transport).request(
        "https://attacker.example/me",
        "GET",
      ),
    ).rejects.toMatchObject({ code: "meta_api_error" });
  });
  it("prepares Reel, carousel and story containers; waits for FINISHED and never publishes an error", async () => {
    const fake = fakeHTTP();
    await fake.provider.createContainer({
      surface: "reel",
      mediaURL: "https://media.example/fixture.mp4",
      caption: "Fixture",
    });
    expect(String(fake.calls.at(-1)!.init.body)).toContain("media_type=REELS");
    expect(String(fake.calls.at(-1)!.init.body)).toContain("video_url=");
    await fake.provider.createContainer({
      surface: "carousel",
      children: ["1", "2"],
      caption: "Fixture",
    });
    expect(String(fake.calls.at(-1)!.init.body)).toContain(
      "media_type=CAROUSEL",
    );
    await fake.provider.createContainer({
      surface: "story",
      mediaURL: "https://media.example/fixture.jpg",
      caption: "",
    });
    expect(String(fake.calls.at(-1)!.init.body)).toContain(
      "media_type=STORIES",
    );
    await expect(
      fakeHTTP({ failContainer: true }).provider.waitForContainer("800"),
    ).rejects.toMatchObject({ code: "container_failed" });
    const progress = fakeHTTP({ progress: true });
    await expect(
      progress.provider.waitForContainer("800"),
    ).rejects.toMatchObject({ code: "processing_timeout" });
    expect(progress.calls).toHaveLength(2);
  });
  it("rejects local expiry without network and gates mutations even with a token", async () => {
    const transport = vi.fn();
    const p = new InstagramPublishingProvider(
      config,
      { ...connection, expiresAt: "2000-01-01T00:00:00Z" },
      new MetaHTTP(transport),
    );
    await expect(p.checkConnection()).rejects.toMatchObject({
      code: "expired_token",
    });
    expect(transport).not.toHaveBeenCalled();
    const disabled = new InstagramPublishingProvider(
      { ...config, enabled: false },
      connection,
      new MetaHTTP(transport),
    );
    await expect(disabled.publishContainer("800")).rejects.toMatchObject({
      code: "publishing_disabled",
    });
  });
});

describe("media hosting and immutable publication packages", () => {
  it("normalizes approved PNG to a hash-bound JPEG without cropping", async () => {
    const meta = await sharp(prepared.path).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1350);
    expect(prepared.sourceSha256).toBe(render.metadata.sha256);
    await expect(
      prepareImage(
        { ...render, metadata: { ...render.metadata, sha256: "wrong" } },
        directory,
      ),
    ).rejects.toMatchObject({ code: "stale_approval" });
  });
  it("fixture hosting remains local/mock", async () => {
    const hosting = new LocalMockMediaHostingProvider(),
      upload = await hosting.upload(prepared, hash("fixture"));
    expect(upload.reference.provider).toBe("local-mock");
    expect(upload.url).toContain(".invalid/");
    await hosting.delete(upload.reference);
    expect(hosting.deleted).toHaveLength(1);
  });
  it("S3 uses private conditional upload, presigned GET and matching bytes", async () => {
    const client = new S3Client({
      region: "us-east-1",
      credentials: {
        accessKeyId: "fixture-id",
        secretAccessKey: "fixture-credential",
      },
    });
    const send = vi.spyOn(client, "send").mockResolvedValue({} as never);
    const bytes = readFileSync(prepared.path),
      transport: HttpTransport = async () =>
        new Response(bytes, { headers: { "Content-Type": "image/jpeg" } });
    const hosting = new S3MediaHostingProvider(
      {
        bucket: "fixture-bucket",
        region: "us-east-1",
        prefix: "polo/",
        urlTTLSeconds: 86400,
        retentionDays: 7,
      },
      client,
      transport,
    );
    const uploaded = await hosting.upload(prepared, hash("fixture"));
    expect(uploaded.url).toContain("X-Amz-Signature");
    expect(send.mock.calls[0]?.[0].input).not.toHaveProperty("ACL");
    expect(send.mock.calls[0]?.[0].input).toHaveProperty("IfNoneMatch", "*");
    await hosting.assertAccessible(uploaded.url, prepared);
    await expect(hosting.delete(uploaded.reference)).rejects.toThrow(
      "retention",
    );
    client.destroy();
  });
  it("inaccessible or mismatched hosted bytes are blocked", async () => {
    const client = new S3Client({
      region: "us-east-1",
      credentials: {
        accessKeyId: "fixture-id",
        secretAccessKey: "fixture-credential",
      },
    });
    const hosting = new S3MediaHostingProvider(
      {
        bucket: "fixture",
        region: "us-east-1",
        prefix: "polo/",
        urlTTLSeconds: 86400,
        retentionDays: 7,
      },
      client,
      async () => response({}, 403),
    );
    await expect(
      hosting.assertAccessible("https://fixture.example/image.jpg", prepared),
    ).rejects.toMatchObject({ code: "media_url_inaccessible" });
    client.destroy();
  });
  it("package is immutable, account-bound, versioned, deterministic and includes both QA records", async () => {
    const a = await buildPublicationPackage(
        fixture,
        fixture.contents[contentId]!,
        "123",
      ),
      b = await buildPublicationPackage(
        fixture,
        fixture.contents[contentId]!,
        "123",
      );
    expect(a.packageHash).toBe(b.packageHash);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.finalAsset)).toBe(true);
    expect(a.aiQA.provider).toBe("fake-http-test");
    expect(a.deterministicQA.passed).toBe(true);
    await expect(
      buildPublicationPackage(fixture, fixture.contents[contentId]!, "456"),
    ).rejects.toThrow("Bind");
  });
  it("rejects fixture QA, stale caption, changed account and changed render bytes", async () => {
    const noAI = structuredClone(fixture);
    noAI.runs.forEach((r) => {
      r.llmCall = false;
    });
    await expect(
      buildPublicationPackage(noAI, noAI.contents[contentId]!, "123"),
    ).rejects.toThrow("AI QA");
    for (const change of ["caption", "account", "rights"]) {
      const stale = structuredClone(fixture),
        c = stale.contents[contentId]!;
      if (change === "caption")
        current(c.copies)!.data.outputs.caption = "edited";
      if (change === "account")
        current(c.metadata)!.data.instagramTarget = {
          accountId: "456",
          surface: "feed",
        };
      if (change === "rights")
        current(c.assets)!.data[0]!.rights = "restricted";
      await expect(
        buildPublicationPackage(stale, c, "123"),
      ).rejects.toMatchObject({ code: "stale_approval" });
    }
    const bytes = readFileSync(render.storageRef);
    try {
      writeFileSync(
        render.storageRef,
        Buffer.concat([bytes, Buffer.from("changed")]),
      );
      await expect(
        buildPublicationPackage(fixture, fixture.contents[contentId]!, "123"),
      ).rejects.toMatchObject({ code: "stale_approval" });
    } finally {
      writeFileSync(render.storageRef, bytes);
    }
  });
});

describe("persistent manual Instagram publication", () => {
  it("creates, checks, publishes and stores receipt without storing signed URL or token", async () => {
    const repository = await repo(),
      fake = fakeHTTP();
    const result = await service(repository, fake.provider).publish(
      contentId,
      "123",
      true,
    );
    expect(result.status).toBe("published");
    expect(result.instagram).toMatchObject({
      containerId: "800",
      igMediaId: "900",
      permalink: "https://www.instagram.com/p/fixture/",
      assetVersion: 2,
      captionVersion: 1,
    });
    expect((await repository.read()).contents[contentId]!.status).toBe(
      "published",
    );
    const stored = JSON.stringify(await repository.read());
    expect(stored).not.toContain("X-Amz-Signature");
    expect(stored).not.toContain("fixture-credential");
    expect(
      fake.calls.filter((c) => c.url.endsWith("/media_publish")),
    ).toHaveLength(1);
  });
  it("never duplicates successful publication across FileRepository restart", async () => {
    const path = join(directory, "restart.json"),
      r = new FileRepository(path);
    await r.transaction(async (s) => {
      Object.assign(s, structuredClone(fixture));
    });
    const fake = fakeHTTP();
    const first = await service(r, fake.provider).publish(
      contentId,
      "123",
      true,
    );
    const afterRestart = fakeHTTP();
    const second = await service(
      new FileRepository(path),
      afterRestart.provider,
    ).publish(contentId, "123", true);
    expect(second.externalId).toBe(first.externalId);
    expect(afterRestart.calls).toHaveLength(0);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });
  it("explicit CLI plus enabled flag are both necessary", async () => {
    for (const [enabled, explicit] of [
      [false, true],
      [true, false],
    ]) {
      const fake = fakeHTTP();
      await expect(
        service(await repo(), fake.provider, undefined, enabled).publish(
          contentId,
          "123",
          explicit!,
        ),
      ).rejects.toMatchObject({ code: "publishing_disabled" });
      expect(fake.calls).toHaveLength(0);
    }
  });
  it("failed containers, expired tokens and inaccessible media never call media_publish", async () => {
    for (const mode of ["container", "token", "url"]) {
      const r = await repo(),
        fake = fakeHTTP({
          failContainer: mode === "container",
          expired: mode === "token",
        }),
        hosting = new LocalMockMediaHostingProvider();
      if (mode === "url")
        hosting.assertAccessible = async () => {
          throw new InstagramError("media_url_inaccessible", true);
        };
      await expect(
        service(r, fake.provider, hosting).publish(contentId, "123", true),
      ).rejects.toThrow();
      expect(fake.calls.some((c) => c.url.endsWith("/media_publish"))).toBe(
        false,
      );
      expect(
        (await r.read()).contents[contentId]!.publications.at(-1)?.status,
      ).toBe("failed");
      expect((await r.read()).contents[contentId]).toBeDefined();
    }
  });
  it("retries pre-publish network failures safely and reuses processing containers", async () => {
    const r = await repo(),
      fake = fakeHTTP({ progress: true });
    await expect(
      service(r, fake.provider).publish(contentId, "123", true),
    ).rejects.toMatchObject({ code: "processing_timeout" });
    const retry = fakeHTTP();
    const result = await service(r, retry.provider).publish(
      contentId,
      "123",
      true,
    );
    expect(result.status).toBe("published");
    expect(retry.calls.some((c) => c.url.endsWith("/media"))).toBe(false);
  });
  it("uncertain publish is persisted and cannot automatically retry, even after restart", async () => {
    const r = await repo(),
      lost = fakeHTTP({ publishLost: true });
    await expect(
      service(r, lost.provider).publish(contentId, "123", true),
    ).rejects.toMatchObject({ code: "reconciliation_required" });
    const persisted = await r.read();
    expect(persisted.contents[contentId]!.publications.at(-1)?.status).toBe(
      "unknown",
    );
    const retry = fakeHTTP();
    await expect(
      service(await repo(persisted), retry.provider).publish(
        contentId,
        "123",
        true,
      ),
    ).rejects.toMatchObject({ code: "reconciliation_required" });
    expect(retry.calls).toHaveLength(0);
  });
  it("permalink failure cannot discard a durable successful receipt", async () => {
    const r = await repo(),
      fake = fakeHTTP({ permalinkFail: true });
    const result = await service(r, fake.provider).publish(
      contentId,
      "123",
      true,
    );
    expect(result.status).toBe("published");
    expect(result.externalId).toBe("900");
    expect(result.instagram?.permalink).toBeNull();
  });
  it("reconciles a confirmed published container and account-owned media without posting again", async () => {
    const r = await repo(),
      lost = fakeHTTP({ publishLost: true });
    await expect(
      service(r, lost.provider).publish(contentId, "123", true),
    ).rejects.toThrow();
    const p = (await r.read()).contents[contentId]!.publications.at(-1)!;
    const base = fakeHTTP();
    const transport: HttpTransport = async (url, init) => {
      if (new URL(url).pathname.endsWith("/800"))
        return response({ id: "800", status_code: "PUBLISHED" });
      if (new URL(url).pathname.endsWith("/123/media") && init.method === "GET")
        return response({
          data: [
            {
              id: "900",
              caption: p.instagram!.publicationPackage.caption,
              timestamp: now(),
            },
          ],
        });
      return base.transport(url, init);
    };
    const provider = new InstagramPublishingProvider(
      config,
      connection,
      new MetaHTTP(transport),
    );
    const result = await service(r, provider).reconcile(
      contentId,
      p.id,
      "123",
      "900",
      "human-reconciler",
    );
    expect(result.status).toBe("published");
    expect(result.instagram?.igMediaId).toBe("900");
    expect(base.calls.some((c) => c.url.endsWith("/media_publish"))).toBe(
      false,
    );
    expect((await r.read()).audit.at(-1)?.kind).toBe(
      "instagram_manual_reconciliation",
    );
  });
  it("an uncertain attempt blocks a new approval or edited version until reconciliation", async () => {
    const r = await repo(),
      lost = fakeHTTP({ publishLost: true });
    await expect(
      service(r, lost.provider).publish(contentId, "123", true),
    ).rejects.toThrow();
    await r.transaction(async (s) => {
      const c = s.contents[contentId]!;
      current(c.copies)!.data.outputs.caption = "Edited after unknown publish";
      c.versions.copy++;
      c.approvals.push({ ...c.approvals.at(-1)!, id: "new-human-approval" });
    });
    const retry = fakeHTTP();
    await expect(
      service(r, retry.provider).publish(contentId, "123", true),
    ).rejects.toMatchObject({ code: "reconciliation_required" });
    expect(retry.calls).toHaveLength(0);
  });
  it("changing approval or QA alone does not republish the same public payload", async () => {
    const r = await repo(),
      first = fakeHTTP();
    await service(r, first.provider).publish(contentId, "123", true);
    await r.transaction(async (s) => {
      const c = s.contents[contentId]!;
      c.versions.review++;
      c.approvals.push({
        ...c.approvals.at(-1)!,
        id: "renewed-human-approval",
      });
    });
    const retry = fakeHTTP();
    expect(
      (await service(r, retry.provider).publish(contentId, "123", true))
        .externalId,
    ).toBe("900");
    expect(retry.calls).toHaveLength(0);
  });
  it("editing the package during upload stops before media_publish", async () => {
    const r = await repo(),
      fake = fakeHTTP(),
      hosting = new LocalMockMediaHostingProvider();
    const upload = hosting.upload.bind(hosting);
    hosting.upload = async (media, pkgHash) => {
      await r.transaction(async (s) => {
        current(s.contents[contentId]!.copies)!.data.outputs.caption =
          "Changed during upload";
      });
      return upload(media, pkgHash);
    };
    await expect(
      service(r, fake.provider, hosting).publish(contentId, "123", true),
    ).rejects.toMatchObject({ code: "stale_approval" });
    expect(fake.calls.some((c) => c.url.endsWith("/media_publish"))).toBe(
      false,
    );
  });
  it("concurrent invocations cannot publish the same package twice", async () => {
    const r = await repo(),
      fake = fakeHTTP();
    const results = await Promise.allSettled([
      service(r, fake.provider).publish(contentId, "123", true),
      service(r, fake.provider).publish(contentId, "123", true),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      fake.calls.filter((c) => c.url.endsWith("/media_publish")),
    ).toHaveLength(1);
  });
});
