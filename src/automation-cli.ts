import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { ensure, redact, id } from "./common/core.js";
import { FileRepository } from "./persistence/repository.js";
import { PrismaRepository } from "./persistence/prisma-repository.js";
import { InstagramVault } from "./integrations/instagram/vault.js";
import { instagramConfig } from "./integrations/instagram/config.js";
import { InstagramPublishingProvider } from "./integrations/instagram/provider.js";
import {
  S3MediaHostingProvider,
  s3Settings,
} from "./integrations/instagram/hosting.js";
import { loadAutomationConfig } from "./automation/config.js";
import {
  FixtureContentSource,
  ManualQueueContentSource,
} from "./automation/sources.js";
import { runAutoCycle } from "./automation/cycle.js";
import { type ContentCandidate } from "./automation/types.js";

if (existsSync(".env")) process.loadEnvFile(".env");
const { values } = parseArgs({
  args: process.argv.slice(3),
  options: {
    input: { type: "string" },
    file: { type: "string" },
    actor: { type: "string" },
    id: { type: "string" },
    fixture: { type: "boolean" },
    "authorize-auto": { type: "boolean" },
    "approve-production": { type: "boolean" },
    out: { type: "string" },
  },
});
const command = process.argv[2] ?? "status";
const repository =
  process.env.REPOSITORY === "postgres"
    ? new PrismaRepository()
    : new FileRepository(
        resolve(
          values.file ?? process.env.DATA_FILE ?? ".local/editorial.json",
        ),
      );
const print = (value: unknown) =>
  console.log(JSON.stringify(redact(value), null, 2));
const config = () => {
  const cfg = loadAutomationConfig();
  if (values.fixture) {
    cfg.accountId = cfg.accountId || "000000000000000";
    cfg.source = "fixture";
    ensure(cfg.dryRun, "--fixture is only allowed in dry-run");
  }
  return cfg;
};
async function main() {
  if (command === "status") {
    const cfg = config(),
      state = await repository.read(),
      a = state.automation;
    print({
      mode: cfg.mode,
      dryRun: cfg.dryRun,
      autoPublishEnabled: cfg.enableAutoPublish,
      realPublishingEnabled: cfg.enableRealPublishing,
      accountId: cfg.accountId || null,
      source: cfg.source,
      provider: process.env.AI_PROVIDER || "gemini",
      geminiConfigured: !!(
        process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
      ),
      queue: a?.queue.length ?? 0,
      candidates: Object.keys(a?.candidates ?? {}).length,
      lease: a?.lease ?? null,
      cycles: a?.cycles.slice(-10) ?? [],
      publicationRecords: Object.values(state.contents).flatMap((c) =>
        c.publications
          .filter((p) => p.provider === "instagram")
          .map((p) => ({
            id: p.id,
            contentId: c.id,
            status: p.status,
            mediaId: p.instagram?.igMediaId,
            permalink: p.instagram?.permalink,
            error: p.instagram?.error ?? null,
          })),
      ),
    });
    return;
  }
  const queue = new ManualQueueContentSource(repository);
  if (command === "queue-add") {
    ensure(
      values.input && values.actor?.trim(),
      "Use --input EVENT_ENVELOPE.json --actor NAME",
    );
    const raw = JSON.parse(
      readFileSync(resolve(values.input), "utf8"),
    ) as Partial<ContentCandidate>;
    ensure(
      raw.event && raw.logicalKey,
      "Input must contain event and logicalKey",
    );
    const candidate: ContentCandidate = {
      ...raw,
      id: raw.id || id("queue"),
      logicalKey: raw.logicalKey,
      event: raw.event,
      assets: raw.assets ?? [],
      verifiedBy: values.actor!,
      consent: {
        risk: raw.consent?.risk ?? "unknown",
        allowAutomatic: values["authorize-auto"] === true,
        ...(values["approve-production"]
          ? { productionApprovedBy: values.actor! }
          : {}),
      },
      timing: raw.timing ?? { mode: "publish_now" },
    };
    print(await queue.enqueue(candidate));
    return;
  }
  if (command === "queue-remove") {
    ensure(values.id && values.actor, "Use --id CANDIDATE_KEY --actor NAME");
    print(await queue.remove(values.id, values.actor));
    return;
  }
  ensure(command === "cycle", `Unknown automation command ${command}`);
  const cfg = config(),
    ig = instagramConfig(),
    connection = new InstagramVault(ig.secretDirectory).connection();
  if (connection && !cfg.accountId)
    process.env.AUTOMATION_INSTAGRAM_ACCOUNT_ID = connection.accountId;
  if (connection && config().accountId !== connection.accountId)
    throw new Error(
      "Automation target differs from connected Instagram account",
    );
  const provider = connection
    ? new InstagramPublishingProvider(
        { ...ig, enabled: cfg.dryRun ? true : ig.enabled },
        connection,
      )
    : undefined;
  const storage = s3Settings();
  const hosting =
    storage.bucket && storage.region
      ? new S3MediaHostingProvider(storage)
      : undefined;
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    const result = await runAutoCycle({
      repository,
      source: cfg.source === "fixture" ? new FixtureContentSource() : queue,
      config,
      fixture: values.fixture || process.env.AI_PROVIDER === "fixture",
      provider,
      hosting,
      signal: controller.signal,
    });
    const out = resolve(
      values.out ??
        process.env.AUTOMATION_REPORT_DIRECTORY ??
        "outputs/automation-reports",
    );
    mkdirSync(out, { recursive: true });
    writeFileSync(
      resolve(out, `${result.id}.json`),
      JSON.stringify(redact(result), null, 2),
    );
    print({ ...result, report: resolve(out, `${result.id}.json`) });
    if (result.status !== "completed" || result.counters.failed)
      process.exitCode = 1;
  } finally {
    hosting?.close();
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}
try {
  await main();
} catch (error) {
  print({
    error: "automation_blocked",
    message:
      error instanceof Error ? error.message : "Automation command failed",
  });
  process.exitCode = 1;
} finally {
  await repository.close();
}
