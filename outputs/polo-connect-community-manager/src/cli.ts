import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { CMError, ensure, id, redact } from "./common/core.js";
import { packageHash } from "./approvals/service.js";
import { CommunityManagerOrchestrator } from "./orchestration/community-manager.js";
import { FileRepository } from "./persistence/repository.js";
import { PrismaRepository } from "./persistence/prisma-repository.js";
import { mockProviders } from "./providers/mock/index.js";
import type { ContentItem } from "./domain/models.js";
import { loadConfig } from "./config/index.js";

if (existsSync(".env")) process.loadEnvFile(".env");
const command = process.argv[2] ?? "inspect";
const { values } = parseArgs({
  args: process.argv.slice(3),
  options: {
    id: { type: "string" },
    event: { type: "string" },
    actor: { type: "string" },
    hash: { type: "string" },
    comment: { type: "string" },
    file: { type: "string" },
    format: { type: "string" },
    "approve-demo": { type: "boolean" },
    "changes-requested": { type: "boolean" },
  },
});
const full = command === "full-demo";
const dataFile =
  values.file ??
  (full
    ? `.local/${id("full-demo")}.json`
    : (process.env.DATA_FILE ?? ".local/editorial.json"));
const repository =
  process.env.REPOSITORY === "postgres"
    ? new PrismaRepository()
    : new FileRepository(resolve(dataFile));
const cm = new CommunityManagerOrchestrator(
  repository,
  mockProviders(),
  undefined,
  loadConfig(),
);
const print = (v: unknown) => console.log(JSON.stringify(redact(v), null, 2));
function summary(c: ContentItem) {
  return {
    id: c.id,
    status: c.status,
    versions: c.versions,
    blockers: c.blockers,
    approval: c.approvals.at(-1)?.state,
    packageHash: packageHash(c),
  };
}

async function main(): Promise<void> {
  const state = await repository.read();
  const contentId = values.id ?? Object.values(state.contents).at(-1)?.id;
  const eventId = values.event ?? Object.values(state.events).at(-1)?.id;
  const format = values.format ?? "single_image";
  ensure(
    ["single_image", "reel", "carousel", "story"].includes(format),
    "Unsupported format",
  );
  if (command === "demo" || full) {
    const [event] = await cm.runDailyDiscovery();
    ensure(event, "No demo event");
    let content = await cm.runOpportunityPipeline(
      event.id,
      format as ContentItem["type"],
    );
    content = await cm.runContentProduction(content.id);
    content = await cm.runQualityReview(content.id);
    print({
      mode: "FICTITIOUS_MOCK",
      dataFile: resolve(dataFile),
      pending: summary(content),
    });
    if (full && values["approve-demo"]) {
      ensure(
        values.actor && values.actor.trim(),
        "--approve-demo requires --actor identifying the person authorizing the fictitious demo",
      );
      await cm.approveContent(
        content.id,
        values.actor,
        packageHash(content),
        "Autorización explícita CLI para fixture ficticio; no publicación real",
      );
      await cm.simulatePublish(content.id);
      await cm.runPerformanceAnalysis(content.id);
      await cm.runWeeklyStrategyReview();
      const s = await repository.read();
      print({
        completed: true,
        content: summary(s.contents[content.id]!),
        learningCount: s.learnings.length,
        skillRuns: s.runs.length,
        transitions: s.audit
          .filter((a) => a.kind === "state_changed")
          .map((a) => `${a.from} -> ${a.to}`),
        flags: cm.config.flags,
      });
    } else
      console.log(
        `Pendiente de aprobación manual. Revisar: npm run cm:inspect -- --id ${content.id}\nAprobar: npm run cm:approve -- --id ${content.id} --actor TU_NOMBRE --hash ${packageHash(content)}`,
      );
    return;
  }
  switch (command) {
    case "discover":
      print(await cm.runDailyDiscovery());
      break;
    case "opportunity":
      ensure(eventId, "Run discover first or pass --event");
      print(
        summary(
          await cm.runOpportunityPipeline(
            eventId,
            format as ContentItem["type"],
          ),
        ),
      );
      break;
    case "produce":
      ensure(contentId, "Pass --id");
      print(summary(await cm.runContentProduction(contentId)));
      break;
    case "qa":
      ensure(contentId, "Pass --id");
      print(summary(await cm.runQualityReview(contentId)));
      break;
    case "approve":
      ensure(
        contentId && values.actor && values.hash,
        "Approval requires --id, --actor and inspected --hash",
      );
      print(
        summary(
          await cm.approveContent(
            contentId,
            values.actor,
            values.hash,
            values.comment,
          ),
        ),
      );
      break;
    case "reject":
      ensure(
        contentId && values.actor && values.hash && values.comment,
        "Rejection requires --id, --actor, --hash and --comment",
      );
      print(
        summary(
          await cm.rejectContent(
            contentId,
            values.actor,
            values.hash,
            values.comment,
            values["changes-requested"],
          ),
        ),
      );
      break;
    case "publish":
      ensure(contentId, "Pass --id");
      print(await cm.simulatePublish(contentId));
      break;
    case "analyze":
      ensure(contentId, "Pass --id");
      print(summary(await cm.runPerformanceAnalysis(contentId)));
      break;
    case "strategy":
      print(await cm.runWeeklyStrategyReview());
      break;
    case "inspect":
      print(await cm.inspect(values.id));
      break;
    default:
      throw new CMError("permanent_error", `Unknown command: ${command}`);
  }
}
try {
  await main();
} catch (e) {
  print({
    error: e instanceof CMError ? e.kind : "permanent_error",
    message: e instanceof Error ? e.message : String(e),
  });
  process.exitCode = 1;
} finally {
  await repository.close();
}
