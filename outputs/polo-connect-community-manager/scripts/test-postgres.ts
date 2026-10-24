import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { resolve, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { CommunityManagerOrchestrator } from "../src/orchestration/community-manager.js";
import { PrismaRepository } from "../src/persistence/prisma-repository.js";
import { mockProviders } from "../src/providers/mock/index.js";
import { packageHash } from "../src/approvals/service.js";
import { ensure, redact } from "../src/common/core.js";

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
const pg = new EmbeddedPostgres({
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
  ensure((await db.workflowRun.count()) >= 9, "Workflow traces missing");
  const before = (await repository.read()).revision;
  await Promise.all(
    Array.from({ length: 3 }, () => repository!.transaction(async () => true)),
  );
  ensure(
    (await repository.read()).revision === before + 3,
    "Concurrent transactions lost writes",
  );
  await repository.close();
  repository = undefined;
  const restored = new PrismaRepository(
    new PrismaClient({ datasourceUrl: connection }),
  );
  ensure(
    (await restored.read()).contents[c.id]?.status === "analyzed",
    "Restart persistence failed",
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
      publishing: "mock_only",
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
