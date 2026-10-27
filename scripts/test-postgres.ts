import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { resolve, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { CommunityManagerOrchestrator } from "../src/orchestration/community-manager.js";
import { PrismaRepository } from "../src/persistence/prisma-repository.js";
import { mockProviders } from "../src/providers/mock/index.js";
import { packageHash } from "../src/approvals/service.js";
import { ensure, redact } from "../src/common/core.js";
import {
  FixtureContentSource,
  ManualQueueContentSource,
} from "../src/automation/sources.js";

const server = createServer();
await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
const address = server.address();
ensure(address && typeof address === "object", "No test port");
const port = address.port;
await new Promise<void>((done, reject) =>
  server.close((e) => (e ? reject(e) : done())),
);
const databaseDir = resolve(
  ".postgres",
  `test-${randomBytes(6).toString("hex")}`,
);
ensure(
  !relative(resolve(".postgres"), databaseDir).startsWith(".."),
  "Test database must stay in workspace",
);
const password = randomBytes(24).toString("hex");
// The dependency's Windows taskkill shutdown can miss an already-fired exit
// event and hang. pg_ctl waits for this specific test cluster to stop instead.
class TestPostgres extends EmbeddedPostgres {
  override async stop(): Promise<void> {
    if (process.platform !== "win32") return super.stop();
    const packageName = "@embedded-postgres/windows-x64";
    const binaries = (await import(packageName)) as { pg_ctl: string };
    if (existsSync(resolve(databaseDir, "postmaster.pid"))) {
      const stopped = spawnSync(
        binaries.pg_ctl,
        ["-D", databaseDir, "stop", "-m", "fast", "-w", "-t", "20"],
        { windowsHide: true, timeout: 25000 },
      );
      ensure(stopped.status === 0, "Temporary PostgreSQL shutdown failed");
    }
    ensure(
      !relative(resolve(".postgres"), databaseDir).startsWith(".."),
      "Unsafe test cleanup path",
    );
    rmSync(databaseDir, { recursive: true, force: true });
  }
}
const pg = new TestPostgres({
  databaseDir,
  user: "polo_test",
  password,
  port,
  persistent: false,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
let db: PrismaClient | undefined;
let repository: PrismaRepository | undefined;
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("polo_test");
  const connection = `postgresql://polo_test:${password}@127.0.0.1:${port}/polo_test?schema=public`;
  const migration = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    {
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: connection },
      timeout: 60000,
      windowsHide: true,
    },
  );
  ensure(
    migration.status === 0,
    `Migration failed: ${String(redact(migration.stderr))}`,
  );
  db = new PrismaClient({ datasourceUrl: connection });
  repository = new PrismaRepository(db);
  const cm = new CommunityManagerOrchestrator(repository, mockProviders());
  const [event] = await cm.runDailyDiscovery();
  ensure(event, "No event");
  let c = await cm.runOpportunityPipeline(event.id);
  c = await cm.runContentProduction(c.id);
  c = await cm.runQualityReview(c.id);
  await cm.approveContent(c.id, "Postgres fixture reviewer", packageHash(c));
  await cm.simulatePublish(c.id);
  await cm.runPerformanceAnalysis(c.id);
  await cm.runWeeklyStrategyReview();
  ensure((await db.contentItem.count()) === 1, "Content projection missing");
  ensure((await db.approval.count()) === 1, "Approval projection missing");
  ensure(
    (await db.publication.count()) === 1,
    "Publication projection missing",
  );
  ensure((await db.learning.count()) === 1, "Learning projection missing");
  ensure(
    (await db.workflowRun.count()) >= 7,
    "Necessary workflow traces missing",
  );
  const skills = (
    await db.workflowRun.findMany({ select: { skill: true } })
  ).map((r) => r.skill);
  ensure(
    !skills.includes("benchmark-researcher"),
    "Per-post benchmark must not execute",
  );
  ensure(
    skills.filter((x) => x === "editorial-strategist").length === 1,
    "Strategy should run only on explicit weekly review",
  );
  const before = (await repository.read()).revision;
  await Promise.all(
    Array.from({ length: 3 }, () => repository!.transaction(async () => true)),
  );
  ensure(
    (await repository.read()).revision === before + 3,
    "Concurrent transactions lost writes",
  );
  // Storage-only Instagram receipt fixture: no provider/network/publication is invoked.
  await repository.transaction(async (s) => {
    const item = s.contents[c.id]!,
      receipt = structuredClone(item.publications[0]!);
    receipt.id = "postgres-instagram-storage-fixture";
    receipt.provider = "instagram";
    receipt.idempotencyKey = "postgres-instagram-storage-fixture-key";
    receipt.externalId = "900";
    receipt.instagram = {
      accountId: "123",
      containerId: "800",
      igMediaId: "900",
      permalink: "https://www.instagram.com/p/storage-fixture/",
      captionVersion: item.versions.copy,
      assetVersion: item.versions.asset,
      phase: "published",
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      publicationPackage: {
        schemaVersion: 1,
        contentId: item.id,
        platform: "instagram",
        accountId: "123",
        surface: "feed",
        versions: { ...item.versions },
        approvalId: item.approvals.at(-1)!.id,
        editorialPackageHash: receipt.packageHash,
        caption: "Storage fixture; not posted",
        assetId: "storage-fixture",
        finalAsset: {
          path: "fixture://not-published.jpg",
          sha256: "storage-fixture",
          sourceSha256: "storage-fixture",
          mimeType: "image/jpeg",
          width: 1080,
          height: 1350,
          byteLength: 0,
        },
        rights: [],
        deterministicQA: {
          passed: true,
          issues: [],
          checks: [],
          sourceOfTruthHash: "storage-fixture",
        },
        aiQA: {
          reviewId: "storage-fixture",
          reviewHash: "storage-fixture",
          runId: "storage-fixture",
          provider: "fixture",
          model: null,
        },
        packageHash: "storage-fixture-package-hash",
      },
    };
    item.publications.push(receipt);
  });
  const instagramReceipt = await db.publication.findUnique({
    where: { id: "postgres-instagram-storage-fixture" },
  });
  ensure(
    instagramReceipt?.igMediaId === "900" &&
      instagramReceipt.containerId === "800" &&
      instagramReceipt.accountId === "123" &&
      instagramReceipt.publicationPackageHash ===
        "storage-fixture-package-hash" &&
      instagramReceipt.captionVersion === c.versions.copy,
    "Instagram relational projection missing",
  );
  const queueCandidate = (await new FixtureContentSource().discover())[0]!;
  await new ManualQueueContentSource(repository).enqueue(queueCandidate);
  await repository.transaction(async (s) => {
    s.automation!.cycles.push({
      id: "postgres-cycle-storage-fixture",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      mode: "supervised",
      dryRun: true,
      simulated: true,
      status: "completed",
      counters: {
        discovered: 1,
        generated: 0,
        skipped: 1,
        duplicate: 0,
        held: 0,
        approval_required: 0,
        auto_approved_by_policy: 0,
        published: 0,
        failed: 0,
      },
      entries: [],
      llmCalls: 0,
      costUsd: 0,
    });
  });
  await repository.close();
  repository = undefined;
  const restored = new PrismaRepository(
    new PrismaClient({ datasourceUrl: connection }),
  );
  ensure(
    (await restored.read()).contents[c.id]?.status === "analyzed",
    "Restart persistence failed",
  );
  ensure(
    (await restored.read()).contents[c.id]?.publications.some(
      (p) => p.instagram?.igMediaId === "900",
    ),
    "Instagram receipt restart persistence failed",
  );
  ensure(
    (await new ManualQueueContentSource(restored).discover()).length === 1,
    "Automation queue restart persistence failed",
  );
  ensure(
    (await restored.read()).automation?.cycles.some(
      (cycle) => cycle.id === "postgres-cycle-storage-fixture",
    ),
    "Automation cycle restart persistence failed",
  );
  await restored.close();
  console.log(
    JSON.stringify({
      postgres: "passed",
      migration: "passed",
      fullPipeline: "passed",
      relationalProjections: "passed",
      concurrency: "passed",
      restart: "passed",
      instagramReceiptProjection: "passed",
      automationQueueAndCyclesRestart: "passed",
      publishing: "mock_and_storage_fixtures_only",
    }),
  );
} catch (e) {
  console.error(String(redact(e instanceof Error ? e.message : String(e))));
  process.exitCode = 1;
} finally {
  await repository?.close();
  await db?.$disconnect();
  await pg.stop();
}
