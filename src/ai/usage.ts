import type { WorkflowRun, Store } from "../domain/models.js";
import { unknownUsage, type Usage } from "./types.js";
const fields = [
  "inputTokens",
  "cachedInputTokens",
  "outputTokens",
  "reasoningTokens",
  "totalTokens",
  "actualCostUsd",
  "estimatedCostUsd",
  "costUsd",
] as const;
export function sumUsage(
  rows: WorkflowRun[],
): Omit<Usage, "costSource"> & {
  unknownMetricRuns: number;
  unknownCostRuns: number;
} {
  const entries = fields.map((field) => {
    const relevant = rows.filter(
      (r) =>
        r.llmCall ||
        (r.usage?.[field] !== undefined && r.usage?.[field] !== null),
    );
    const values = relevant
      .map((r) => r.usage?.[field] ?? null)
      .filter((v): v is number => v !== null);
    return [
      field,
      values.length && values.length === relevant.length
        ? values.reduce((a, b) => a + b, 0)
        : null,
    ];
  });
  return {
    ...unknownUsage(),
    ...Object.fromEntries(entries),
    unknownMetricRuns: rows.filter(
      (r) =>
        r.llmCall &&
        (r.usage?.totalTokens === null || r.usage?.totalTokens === undefined),
    ).length,
    unknownCostRuns: rows.filter((r) => r.llmCall && r.usage?.costUsd == null)
      .length,
  };
}
export function usageReport(store: Store, contentId?: string) {
  const rows = store.runs.filter(
    (r) => !contentId || r.contentId === contentId,
  );
  const group = (key: (r: WorkflowRun) => string) => {
    const groups = new Map<string, WorkflowRun[]>();
    for (const row of rows) {
      const k = key(row);
      groups.set(k, [...(groups.get(k) ?? []), row]);
    }
    return [...groups].map(([key, runs]) => ({
      key,
      attempts: runs.length,
      llmCalls: runs.filter((r) => r.llmCall).length,
      ...sumUsage(runs),
    }));
  };
  return {
    contentId: contentId ?? null,
    rows: rows.map((r) => ({
      id: r.id,
      skill: r.skill,
      workflowId: r.workflowId ?? null,
      workflowClass: r.workflowClass ?? null,
      model: r.model,
      provider: r.provider ?? null,
      status: r.status,
      usage: r.usage ?? unknownUsage(),
      estimatedInputTokens: r.estimatedInputTokens ?? null,
      latencyMs: r.latencyMs ?? r.durationMs,
      selectedReferences: r.selectedReferences ?? [],
      reason: r.reason ?? null,
    })),
    totals: sumUsage(rows),
    llmCalls: rows.filter((r) => r.llmCall).length,
    cacheHits: store.audit.filter(
      (a) =>
        a.kind === "skill_cache_hit" &&
        (!contentId || a.contentId === contentId),
    ).length,
    byContent: group((r) => r.contentId ?? "unbound"),
    bySkill: group((r) => r.skill),
    byWorkflow: group((r) => r.workflowId ?? "legacy"),
    byDay: group((r) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(r.startedAt)),
    ),
    byModel: group((r) => r.model ?? "unavailable"),
    byClass: group((r) => r.workflowClass ?? "legacy"),
  };
}
