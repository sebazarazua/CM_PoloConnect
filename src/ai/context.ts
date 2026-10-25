import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { current, type SkillName, type Store } from "../domain/models.js";
import { hash } from "../common/core.js";
import type { SkillInput } from "../skills/runtime.js";
import type { AISettings, PreparedContext } from "./types.js";
import { finalRenderInputs } from "../render/visual-input.js";
import { decisionContract, families } from "../render/catalog.js";

export interface RecentContentSummary {
  totalInWindow: number;
  sampleSize: number;
  byFormat: Record<string, number>;
  recent: Array<{
    id: string;
    eventId: string;
    format: string;
    subjects: string[];
    hook: string | null;
    series: string | null;
    cta: string | null;
    opportunityId: string | null;
    compositionFamily: string | null;
  }>;
  saturationSignals: Array<{ dimension: string; value: string; count: number }>;
}
const text = (v: unknown): string | null => (typeof v === "string" ? v : null);
export function recentSummary(
  store: Store,
  settings: AISettings,
  excludeId?: string,
  at = Date.now(),
): RecentContentSummary {
  const all = Object.values(store.contents)
    .filter(
      (c) =>
        c.id !== excludeId &&
        Date.parse(c.createdAt) >=
          at - settings.context.recentDays * 86400000 &&
        c.status !== "archived",
    )
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
    );
  const recent = all.slice(0, settings.context.maxRecent).map((c) => {
    const event = Object.values(store.events).find((e) => e.id === c.eventId);
    const plan = current(c.plans)?.data;
    return {
      id: c.id,
      eventId: c.eventId,
      format: c.type,
      subjects: event?.data.entities.map((e) => e.canonical_name) ?? [],
      hook: plan
        ? "hook" in plan
          ? text((plan.hook as { type?: unknown })?.type)
          : text((plan.strategy as { design_job?: unknown })?.design_job)
        : null,
      series: text(current(c.metadata)?.data.series),
      cta: current(c.copies)?.data.outputs.cta ?? null,
      opportunityId: c.opportunity?.opportunity_id ?? null,
      compositionFamily: text(
        current(c.assets)?.data.find((a) => a.stage === "rendered")?.metadata
          .compositionFamily,
      ),
    };
  });
  const dimensions = [
    "eventId",
    "format",
    "hook",
    "series",
    "cta",
    "opportunityId",
    "compositionFamily",
  ] as const;
  const signals: RecentContentSummary["saturationSignals"] = [];
  for (const dim of dimensions) {
    const counts = new Map<string, number>();
    for (const c of recent) {
      const value = c[dim];
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    for (const [value, count] of counts)
      if (count >= 2) signals.push({ dimension: dim, value, count });
  }
  const subjects = new Map<string, number>();
  for (const c of recent)
    for (const s of c.subjects) subjects.set(s, (subjects.get(s) ?? 0) + 1);
  for (const [value, count] of subjects)
    if (count >= 2) signals.push({ dimension: "subject", value, count });
  return {
    totalInWindow: all.length,
    sampleSize: recent.length,
    byFormat: all.reduce(
      (m, c) => {
        m[c.type] = (m[c.type] ?? 0) + 1;
        return m;
      },
      {} as Record<string, number>,
    ),
    recent,
    saturationSignals: signals.slice(0, 40),
  };
}
export function editorialSummary(
  store: Store,
  settings: AISettings,
  excludeId?: string,
): unknown {
  const c = excludeId ? store.contents[excludeId] : undefined;
  const plan = current(store.strategies)?.data;
  const relevance = (scope: string) =>
    Number(!!c && scope.toLowerCase().includes(c.type)) +
    Number(!!c?.objective && scope.toLowerCase().includes(c.objective));
  const learnings = [...store.learnings]
    .sort(
      (a, b) =>
        relevance(b.scope) - relevance(a.scope) || b.at.localeCompare(a.at),
    )
    .slice(0, settings.context.maxLearnings)
    .map((l) => ({
      id: l.learning_id,
      statement: l.statement,
      maturity: l.maturity,
      confidence: l.confidence,
      scope: l.scope,
      evidence: l.evidence,
      nextTest: l.next_test,
      simulated: l.simulated,
    }));
  const benchmarks = [...store.benchmarks]
    .sort(
      (a, b) =>
        Number(b.content.format === c?.type) -
          Number(a.content.format === c?.type) ||
        b.observed_at.localeCompare(a.observed_at),
    )
    .slice(0, settings.context.maxBenchmarks)
    .map((b) => ({
      fingerprint: hash(b),
      mechanisms: b.analysis.mechanisms,
      principle: b.transfer.principle,
      application: b.transfer.polo_connect_application,
      confidence: b.analysis.confidence,
      patternStatus: b.analysis.pattern_status,
    }));
  return {
    currentStrategy: plan
      ? {
          planId: plan.plan_id,
          window: plan.planning_window,
          objectives: plan.objectives,
          audiences: plan.audiences,
          pillars: plan.pillars,
          capacity: plan.capacity,
          opportunityBrief: plan.opportunity_detector_brief,
        }
      : null,
    relevantLearnings: learnings,
    relevantBenchmarkPatterns: benchmarks,
    recentContent: recentSummary(store, settings, excludeId),
    brand: JSON.parse(
      readFileSync(resolve("brand/system.json"), "utf8"),
    ) as unknown,
    mode: "local_media; inspect per-asset actualMedia and simulated flags",
    humanApprovalRequired: true,
  };
}
export function selectReferences(
  skill: SkillName,
  input: SkillInput,
): string[] {
  const map = JSON.parse(
    readFileSync(resolve("config/reference-map.json"), "utf8"),
  ) as Record<SkillName, Record<string, string[]>>;
  const policy = map[skill];
  const groups = ["core"];
  if (input.format === "carousel") groups.push("carousel");
  if (input.assets?.some((a) => a.type === "photo")) groups.push("photo");
  if (input.event?.event_type === "match_result") groups.push("data");
  if (skill === "copywriter") groups.push("overlays");
  if (
    ["live_viewership", "replay_viewership", "product_discovery"].includes(
      input.opportunity?.strategy.primary_objective ?? "",
    ) ||
    current(input.content?.metadata ?? [])?.data.requiresLink === true
  )
    groups.push("cta");
  if (input.format === "story") groups.push("multi_surface");
  if (skill === "reel-planner") groups.push("cover", "subtitles");
  if (skill === "polo-news-researcher") groups.push("priority", "rights");
  if (skill === "content-opportunity-detector") groups.push("timing");
  if (skill === "editorial-strategist") groups.push("feedback");
  if (skill === "performance-analyst") groups.push("baseline");
  if (input.stage === "pre_publish") groups.push("approval", "platform");
  return [...new Set(groups.flatMap((g) => policy[g] ?? []))].sort();
}
/** Projection only: original current fact ledger is never truncated or summarized away. */
export function structuredInputs(skill: SkillName, input: SkillInput): unknown {
  const c = input.content;
  const selected: Record<string, unknown> = {
    candidate: input.candidate,
    event: input.event,
    opportunity: input.opportunity,
    assets: input.assets,
    format: input.format,
    stage: input.stage,
    snapshot: input.snapshot,
  };
  if (c) {
    const { asset, copy, metadata } = c.versions;
    selected.content = {
      id: c.id,
      eventId: c.eventId,
      type: c.type,
      objective: c.objective,
      audienceJob: c.audienceJob,
      versions: { asset, copy, metadata },
      metadata: current(c.metadata)?.data,
      ...(["copywriter", "quality-reviewer"].includes(skill)
        ? {
            creativePlan: current(c.plans)?.data,
            assets: current(c.assets)?.data,
          }
        : {}),
      ...(skill === "quality-reviewer"
        ? {
            copy: current(c.copies)?.data,
            deterministicGate: input.deterministicGate,
          }
        : {}),
      ...(input.stage === "pre_publish"
        ? { approval: c.approvals.at(-1) }
        : {}),
    };
  }
  return selected;
}
export function preparedContext(
  skill: SkillName,
  input: SkillInput,
  instructions: string,
  references: Record<string, string>,
): PreparedContext {
  return {
    skillCore: instructions,
    relevantReferences: references,
    taskContext:
      skill === "social-designer"
        ? {
            ...((input.context as object) ?? {}),
            renderDirection: {
              ...decisionContract,
              families: Object.entries(families)
                .filter(([, f]) =>
                  input.event?.event_type === "match_result"
                    ? ["result", "story"].includes(f.group)
                    : true,
                )
                .map(([name]) => name),
            },
          }
        : (input.context ?? null),
    structuredInputs: structuredInputs(skill, input),
    ...(skill === "quality-reviewer"
      ? {
          visualAssets: finalRenderInputs(
            current(input.content?.assets ?? [])?.data ?? [],
          ),
        }
      : {}),
  };
}
