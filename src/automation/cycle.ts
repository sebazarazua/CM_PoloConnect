import { resolve } from "node:path";
import { ensure, hash, id, now, CMError, redact } from "../common/core.js";
import { current, type Asset, type ContentItem } from "../domain/models.js";
import { packageHash } from "../approvals/service.js";
import type { EditorialRepository } from "../persistence/repository.js";
import { CommunityManagerOrchestrator } from "../orchestration/community-manager.js";
import { mockProviders } from "../providers/mock/index.js";
import { LocalDesignRenderer } from "../render/provider.js";
import { productionMark } from "../render/brand.js";
import { InstagramPublicationService } from "../integrations/instagram/service.js";
import type { InstagramPublishingContract } from "../integrations/instagram/provider.js";
import type { MediaHostingProvider } from "../integrations/instagram/hosting.js";
import { selectedAISettings, selectedExecutor } from "../ai/factory.js";
import type { AISettings } from "../ai/types.js";
import type { SkillExecutor } from "../skills/runtime.js";
import { FixtureSkillExecutor } from "../skills/fixture-executor.js";
import { OutputValidator, SkillRegistry } from "../skills/runtime.js";
import { loadConfig } from "../config/index.js";
import {
  candidateKey,
  validateCandidate,
  type ContentSourceProvider,
} from "./sources.js";
import {
  sourceEligibility,
  AutomaticPublishingPolicy,
  cycleSpending,
} from "./policy.js";
import { type AutomationConfig } from "./config.js";
import {
  AutomaticPublicationAuthority,
  grantPolicyApproval,
} from "./authority.js";
import { InstagramDryRunStage } from "./dry-run.js";
import {
  emptyAutomation,
  type AutomationCycle,
  type CandidateRecord,
  type CycleEntry,
} from "./types.js";

export interface AutoCycleOptions {
  repository: EditorialRepository;
  source: ContentSourceProvider;
  config: () => AutomationConfig;
  executor?: SkillExecutor;
  settings?: AISettings;
  provider?: InstagramPublishingContract;
  hosting?: MediaHostingProvider;
  fixture?: boolean;
  fixtureHTTP?: boolean;
  outputDirectory?: string;
  clock?: () => Date;
  signal?: AbortSignal;
}
const counters = (): AutomationCycle["counters"] => ({
  discovered: 0,
  generated: 0,
  skipped: 0,
  duplicate: 0,
  held: 0,
  approval_required: 0,
  auto_approved_by_policy: 0,
  published: 0,
  failed: 0,
});
function brandAsset(): Asset {
  const mark = productionMark("dark");
  return {
    id: "polo-connect-owned-icon",
    type: "logo",
    stage: "approved",
    storageRef: mark.path,
    rights: "owned",
    required: true,
    source: "User-supplied Polo Connect brand mark",
    credit: "Polo Connect",
    metadata: {
      actualMedia: true,
      sha256: mark.sha256,
      width: mark.width,
      height: mark.height,
      mimeType: "image/png",
    },
  };
}
export async function runAutoCycle(
  options: AutoCycleOptions,
): Promise<AutomationCycle> {
  const { repository, source } = options,
    clock = options.clock ?? (() => new Date()),
    cfg = options.config(),
    cycleId = id("cycle");
  const cycle: AutomationCycle = {
    id: cycleId,
    startedAt: clock().toISOString(),
    endedAt: null,
    mode: cfg.mode,
    dryRun: cfg.dryRun,
    simulated: !!options.fixture || !!options.fixtureHTTP,
    status: "running",
    counters: counters(),
    entries: [],
    llmCalls: 0,
    costUsd: 0,
  };
  await repository.transaction(async (store) => {
    const state = (store.automation ??= emptyAutomation());
    ensure(
      !state.lease || Date.parse(state.lease.expiresAt) <= clock().getTime(),
      "An automation cycle is already active",
    );
    for (const old of state.cycles)
      if (old.status === "running") {
        old.status = "interrupted";
        old.endedAt = clock().toISOString();
      }
    state.lease = {
      owner: cycleId,
      expiresAt: new Date(
        clock().getTime() + cfg.leaseMinutes * 60000,
      ).toISOString(),
    };
    state.cycles.push(structuredClone(cycle));
  });
  let renderer: LocalDesignRenderer | undefined,
    cm: CommunityManagerOrchestrator | undefined;
  const checkpoint = () =>
    repository.transaction(async (store) => {
      const state = store.automation!;
      ensure(state.lease?.owner === cycleId, "Cycle lease lost");
      ensure(
        Date.parse(state.lease.expiresAt) > clock().getTime(),
        "Cycle exceeded its lease; stop before another external action",
      );
      const spent = cycleSpending(store, cycle.startedAt);
      cycle.llmCalls = spent.calls;
      cycle.costUsd = spent.costUsd;
      const index = state.cycles.findIndex((c) => c.id === cycleId);
      state.cycles[index] = structuredClone(cycle);
    });
  const updateRecord = (key: string, change: Partial<CandidateRecord>) =>
    repository.transaction(async (s) => {
      ensure(s.automation?.lease?.owner === cycleId, "Cycle lease lost");
      if (
        s.automation.candidates[key]!.reason?.includes(
          "input_removed_from_queue",
        )
      )
        return;
      Object.assign(s.automation.candidates[key]!, change, {
        updatedAt: clock().toISOString(),
        lastCycleId: cycleId,
      });
    });
  const entry = (
    record: CandidateRecord,
    verdict: CycleEntry["verdict"],
    reason: string[],
    item?: ContentItem,
  ): CycleEntry => ({
    candidateKey: record.key,
    contentId: item?.id ?? record.contentId,
    ...(item
      ? {
          content: {
            id: item.id,
            eventId: item.eventId,
            title: item.title,
            status: item.status,
            versions: { ...item.versions },
          },
        }
      : {}),
    verdict,
    reason,
    would_publish: false,
    caption: current(item?.copies ?? [])?.data.outputs.caption ?? undefined,
    asset: current(item?.assets ?? [])?.data.find((a) => a.stage === "rendered")
      ?.storageRef,
    target: cfg.accountId || null,
    simulated: cycle.simulated,
  });
  const getCM = () => {
    if (cm) return cm;
    const settings = {
      ...(options.settings ?? selectedAISettings()),
      automationScope: {
        startedAt: cycle.startedAt,
        maxCalls: cfg.maxLlmCallsPerCycle,
        maxCostUsd: cfg.maxCostUsdPerCycle,
        signal: options.signal,
      },
    };
    const executor =
      options.executor ??
      (options.fixture
        ? new FixtureSkillExecutor()
        : selectedExecutor(settings));
    renderer = new LocalDesignRenderer(
      resolve(
        options.outputDirectory ??
          process.env.AUTOMATION_RENDER_DIRECTORY ??
          "outputs/automation",
      ),
      ["feed"],
    );
    const providers = mockProviders();
    providers.design = renderer;
    cm = new CommunityManagerOrchestrator(
      repository,
      providers,
      executor,
      loadConfig(),
      settings,
      {
        objective:
          "Publish timely, verified structured polo results for the Polo Connect community.",
        scope:
          "Use the persisted editorial strategy when present. This bounded automation task supports one Instagram feed result with the approved Polo Connect brand system, verified score and clear tournament context.",
        constraints:
          "No research, invented facts, inferred rights, synthetic action photos or publication approval. Use supplied owned/licensed media. Fictitious results must visibly say PRUEBA TÉCNICA and datos ficticios. Final QA must inspect the attached render and current publishing route.",
      },
    );
    return cm;
  };
  try {
    const discovered = await source.discover();
    cycle.counters.discovered = discovered.length;
    const validator = new OutputValidator(new SkillRegistry());
    for (const candidate of discovered) {
      if (options.signal?.aborted)
        throw new CMError("blocked_input", "Automation interrupted");
      try {
        validateCandidate(candidate, validator);
        const key = candidateKey(candidate);
        await repository.transaction(async (store) => {
          const state = store.automation!;
          ensure(state.lease?.owner === cycleId, "Cycle lease lost");
          if (state.candidates[key]) {
            cycle.counters.duplicate++;
            return;
          }
          state.candidates[key] = {
            key,
            candidate: structuredClone(candidate),
            source: source.name,
            createdAt: clock().toISOString(),
            updatedAt: clock().toISOString(),
          };
        });
      } catch (error) {
        cycle.counters.failed++;
        cycle.entries.push({
          candidateKey: hash(candidate),
          verdict: "reject",
          reason: ["invalid_candidate_contract"],
          would_publish: false,
          target: cfg.accountId || null,
          simulated: cycle.simulated,
          error: String(
            redact(
              error instanceof Error ? error.message : "Invalid candidate",
            ),
          ),
        });
      }
    }
    await checkpoint();
    const records = Object.values(
      (await repository.read()).automation!.candidates,
    )
      .filter(
        (r) =>
          r.verdict !== "reject" || r.reason?.includes("already_published"),
      )
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    let processed = 0;
    for (const record of records) {
      if (processed >= cfg.maxCandidates) break;
      if (options.signal?.aborted)
        throw new CMError("blocked_input", "Automation interrupted");
      await checkpoint();
      const candidate = record.candidate,
        state = await repository.read();
      let item = record.contentId
        ? state.contents[record.contentId]
        : undefined;
      if (
        item?.publications.some(
          (p) =>
            p.provider === "instagram" &&
            p.status === "published" &&
            p.instagram?.accountId === cfg.accountId &&
            p.packageHash === packageHash(item!),
        )
      ) {
        cycle.counters.skipped++;
        await updateRecord(record.key, {
          verdict: "reject",
          reason: ["already_published"],
        });
        continue;
      }
      processed++;
      try {
        const eligibility = sourceEligibility(candidate, cfg);
        if (eligibility.verdict !== "ready") {
          cycle.entries.push(
            entry(record, eligibility.verdict, eligibility.reason, item),
          );
          if (eligibility.verdict === "needs_human_approval")
            cycle.counters.approval_required++;
          else if (eligibility.verdict === "hold") cycle.counters.held++;
          else cycle.counters.skipped++;
          await updateRecord(record.key, {
            verdict: eligibility.verdict,
            reason: eligibility.reason,
          });
          continue;
        }
        if (cfg.mode === "manual" && !candidate.consent.productionApprovedBy) {
          cycle.entries.push(
            entry(
              record,
              "needs_human_approval",
              ["manual_mode_requires_production_approval"],
              item,
            ),
          );
          cycle.counters.approval_required++;
          await updateRecord(record.key, {
            verdict: "needs_human_approval",
            reason: ["manual_mode_requires_production_approval"],
          });
          continue;
        }
        if (!/^\d+$/.test(cfg.accountId)) {
          cycle.entries.push(
            entry(record, "hold", ["target_account_not_configured"], item),
          );
          cycle.counters.held++;
          await updateRecord(record.key, {
            verdict: "hold",
            reason: ["target_account_not_configured"],
          });
          continue;
        }
        const spent = cycleSpending(state, cycle.startedAt);
        if (
          spent.unknown ||
          spent.calls >= cfg.maxLlmCallsPerCycle ||
          spent.costUsd >= cfg.maxCostUsdPerCycle
        ) {
          cycle.entries.push(
            entry(record, "hold", ["cycle_generation_budget_limit"], item),
          );
          cycle.counters.held++;
          continue;
        }
        const manager = getCM();
        if (!item) {
          const event = await manager.importVerifiedEvent(
            { logicalKey: candidate.logicalKey, candidate: candidate.event },
            candidate.verifiedBy,
          );
          item = Object.values((await repository.read()).contents).find(
            (c) => c.eventId === event.id && c.type === "single_image",
          );
          ensure(item, "Imported event did not create content");
          await updateRecord(record.key, {
            contentId: item.id,
            eventId: event.id,
          });
        }
        const sourceAssets = candidate.assets.length
          ? candidate.assets
          : [brandAsset()];
        if (!item.opportunity || (
          current(item.metadata)?.data.automationCandidateKey !== record.key &&
          hash(current(item.assets)?.data.filter(a => a.stage !== "rendered")) !== hash(sourceAssets)
        ))
          item = await manager.runOpportunityPipeline(
            item.eventId,
            "single_image",
            sourceAssets,
          );
        if (!item.opportunity || item.blockers.length) {
          cycle.entries.push(
            entry(record, "hold", ["opportunity_not_publishable"], item),
          );
          cycle.counters.held++;
          continue;
        }
        const productionCurrent =
          current(item.plans) &&
          !current(item.plans)?.stale &&
          current(item.copies) &&
          !current(item.copies)?.stale &&
          current(item.assets)?.data.some(
            (a) => a.stage === "rendered" && a.metadata.actualMedia === true,
          );
        const bound =
          (
            current(item.metadata)?.data.instagramTarget as
              { accountId?: string } | undefined
          )?.accountId === cfg.accountId &&
          current(item.metadata)?.data.automationCandidateKey === record.key;
        if (
          bound &&
          hash(
            current(item.assets)?.data.filter((a) => a.stage !== "rendered"),
          ) !== hash(sourceAssets)
        ) {
          cycle.entries.push(
            entry(
              record,
              "hold",
              ["source_inventory_changed_requeue_event"],
              item,
            ),
          );
          cycle.counters.held++;
          await updateRecord(record.key, {
            verdict: "hold",
            reason: ["source_inventory_changed_requeue_event"],
          });
          continue;
        }
        if (!bound)
          item = await manager.reviseContent(
            item.id,
            {
              assets: sourceAssets,
              metadata: {
                ...current(item.metadata)!.data,
                instagramTarget: { accountId: cfg.accountId, surface: "feed" },
                publishingRoute: "instagram_api_with_instagram_login",
                automationCandidateKey: record.key,
                automationSourceAssetsHash: hash(sourceAssets),
                automationTiming: candidate.timing,
                automationConsent: candidate.consent,
              },
            },
            "automation-target-binding",
          );
        if (!productionCurrent || !bound) {
          item = await manager.runContentProduction(item.id);
          cycle.counters.generated++;
        }
        if (
          candidate.event.simulated === true &&
          current(item.copies)?.data.outputs.caption &&
          !/^PRUEBA TÉCNICA/.test(current(item.copies)!.data.outputs.caption!)
        ) {
          const copy = structuredClone(current(item.copies)!.data);
          copy.outputs.caption = `PRUEBA TÉCNICA · Datos ficticios.\n\n${copy.outputs.caption}`;
          item = await manager.reviseContent(
            item.id,
            { copy },
            "automation-fixture-labelling",
          );
        }
        if (
          ["ready_for_qa", "qa_failed", "ready_for_human_approval"].includes(
            item.status,
          )
        )
          item = await manager.runQualityReview(item.id);
        const latest = await repository.read();
        item = latest.contents[item.id]!;
        const currentConfig = options.config(),
          decision = new AutomaticPublishingPolicy().evaluate(
            latest,
            item,
            candidate,
            currentConfig,
            clock(),
            cycleId,
          );
        const outcome = entry(record, decision.verdict, decision.reason, item);
        await updateRecord(record.key, {
          contentId: item.id,
          eventId: item.eventId,
          verdict: decision.verdict,
          reason: decision.reason,
          lastPackageHash: decision.packageHash,
        });
        if (decision.verdict === "auto_publish") {
          ensure(
            !options.signal?.aborted,
            "Automation interrupted before publication",
          );
          ensure(
            !options.fixture,
            "Fixture planning/QA cannot authorize a real or would-publish result",
          );
          ensure(
            options.provider && options.hosting,
            "Instagram/S3 connection is required for dry-run staging or publication",
          );
          cycle.counters.auto_approved_by_policy++;
          if (currentConfig.dryRun) {
            const staged = await new InstagramDryRunStage(
              repository,
              options.provider,
              options.hosting,
              !!options.fixtureHTTP,
            ).prepare(item, decision, cycleId);
            outcome.would_publish = true;
            outcome.reason.push(
              "dry_run_container_ready_media_publish_not_called",
              `container:${staged.containerId}`,
            );
          } else {
            ensure(
              currentConfig.enableRealPublishing,
              "ENABLE_REAL_PUBLISHING=true is also required for live publication",
            );
            await repository.transaction(async (s) => {
              ensure(
                s.automation?.lease?.owner === cycleId,
                "Cycle lease lost",
              );
              const fresh = new AutomaticPublishingPolicy().evaluate(
                s,
                s.contents[item!.id]!,
                candidate,
                options.config(),
                clock(),
                cycleId,
              );
              grantPolicyApproval(s, s.contents[item!.id]!, fresh);
            });
            await checkpoint();
            const authority = new AutomaticPublicationAuthority(
              candidate,
              () => {
                ensure(
                  !options.signal?.aborted,
                  "Automation interrupted before publication",
                );
                return options.config();
              },
              cycleId,
              clock,
            );
            const published = await new InstagramPublicationService(
              repository,
              options.provider,
              options.hosting,
              true,
              !!options.fixtureHTTP,
              authority,
            ).publish(item.id, currentConfig.accountId, false);
            cycle.counters.published++;
            outcome.publicationId = published.id;
          }
        } else if (decision.verdict === "needs_human_approval")
          cycle.counters.approval_required++;
        else if (decision.verdict === "hold") cycle.counters.held++;
        else cycle.counters.skipped++;
        cycle.entries.push(outcome);
      } catch (error) {
        cycle.counters.failed++;
        const reason =
          error instanceof CMError ? error.kind : "automation_provider_failure";
        cycle.entries.push({
          ...entry(record, "hold", [reason], item),
          error: String(
            redact(
              error instanceof Error ? error.message : "Cycle item failed",
            ),
          ),
        });
        await updateRecord(record.key, { verdict: "hold", reason: [reason] });
      }
      await checkpoint();
    }
    cycle.status = "completed";
  } catch (error) {
    cycle.status = options.signal?.aborted ? "interrupted" : "failed";
    cycle.error = String(
      redact(error instanceof Error ? error.message : "Auto-cycle failed"),
    );
    cycle.counters.failed++;
  } finally {
    await renderer?.close();
    cycle.endedAt = clock().toISOString();
    await repository.transaction(async (s) => {
      const state = s.automation!;
      if (state.lease?.owner !== cycleId) return;
      const spent = cycleSpending(s, cycle.startedAt);
      cycle.llmCalls = spent.calls;
      cycle.costUsd = spent.costUsd;
      state.cycles[state.cycles.findIndex((c) => c.id === cycleId)] =
        structuredClone(cycle);
      delete state.lease;
      s.audit.push({
        id: id("audit"),
        contentId: null,
        kind: "automation_cycle_finished",
        at: now(),
        detail: { cycleId, status: cycle.status, counters: cycle.counters },
      });
    });
  }
  return cycle;
}
