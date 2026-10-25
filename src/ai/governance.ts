import { CMError } from "../common/core.js";
import type { ContentItem, SkillName, Store } from "../domain/models.js";
import type {
  AISettings,
  BudgetCharge,
  BudgetLimits,
  Usage,
  WorkflowClass,
} from "./types.js";

export class BudgetExceeded extends CMError {
  constructor(
    message: string,
    readonly contentId: string | null,
    readonly workflowId: string,
  ) {
    super("budget_exceeded", message, "human-budget-reviewer");
  }
}
export function classify(
  eventType: string,
  format: ContentItem["type"] = "single_image",
): WorkflowClass {
  if (
    ["campaign", "interview", "tournament_launch", "special_report"].includes(
      eventType,
    )
  )
    return "PREMIUM";
  if (format === "reel" || format === "carousel") return "STANDARD";
  return [
    "match_result",
    "fixture",
    "live_now",
    "replay",
    "structured_update",
  ].includes(eventType)
    ? "FAST"
    : "STANDARD";
}
export function classFor(
  skill: SkillName,
  store: Store,
  contentId: string | null,
): WorkflowClass {
  const c = contentId ? store.contents[contentId] : undefined;
  if (c)
    return (
      c.workflowClass ??
      classify(
        Object.values(store.events).find((e) => e.id === c.eventId)?.data
          .event_type ?? "",
        c.type,
      )
    );
  return ["editorial-strategist", "benchmark-researcher"].includes(skill)
    ? "PREMIUM"
    : "STANDARD";
}
export function remainingBudget(
  store: Store,
  workflowId: string,
  limits: BudgetLimits,
  extra: Array<{
    id: string;
    workflowId: string;
    budgetCharge: BudgetCharge;
  }> = [],
): BudgetLimits {
  const known = new Set(store.runs.map((r) => r.id));
  const rows = [
    ...store.runs,
    ...(store.budgetReservations ?? []).filter((r) => !known.has(r.id)),
    ...extra.filter(
      (r) =>
        !known.has(r.id) &&
        !store.budgetReservations?.some((x) => x.id === r.id),
    ),
  ];
  const spent = rows
    .filter((r) => r.workflowId === workflowId)
    .reduce(
      (sum, r) => {
        const c = r.budgetCharge;
        return c
          ? {
              maxCalls: sum.maxCalls + c.calls,
              maxInputTokens: sum.maxInputTokens + c.inputTokens,
              maxOutputTokens: sum.maxOutputTokens + c.outputTokens,
              maxCostUsd: (sum.maxCostUsd ?? 0) + (c.costUsd ?? 0),
            }
          : sum;
      },
      {
        maxCalls: 0,
        maxInputTokens: 0,
        maxOutputTokens: 0,
        maxCostUsd: 0,
      } as BudgetLimits,
    );
  return {
    maxCalls: Math.max(0, limits.maxCalls - spent.maxCalls),
    maxInputTokens: Math.max(0, limits.maxInputTokens - spent.maxInputTokens),
    maxOutputTokens: Math.max(
      0,
      limits.maxOutputTokens - spent.maxOutputTokens,
    ),
    maxCostUsd:
      limits.maxCostUsd === null
        ? null
        : Math.max(0, limits.maxCostUsd - (spent.maxCostUsd ?? 0)),
  };
}
export function estimateCost(
  settings: AISettings,
  model: string | null,
  input: number,
  output: number,
  cached?: number,
): number | null {
  const p = model ? settings.pricing.models[model] : undefined;
  if (!p) return null;
  return (
    ((cached === undefined
      ? input * Math.max(p.input, p.cachedInput)
      : (input - cached) * p.input + cached * p.cachedInput) +
      output * p.output) /
    1e6
  );
}
export function withCost(
  usage: Usage,
  settings: AISettings,
  model: string | null,
): Usage {
  const estimated =
    usage.inputTokens !== null && usage.outputTokens !== null
      ? estimateCost(
          settings,
          model,
          usage.inputTokens,
          usage.outputTokens,
          usage.cachedInputTokens ?? undefined,
        )
      : null;
  return {
    ...usage,
    estimatedCostUsd: usage.estimatedCostUsd ?? estimated,
    costUsd: usage.actualCostUsd ?? usage.estimatedCostUsd ?? estimated,
    costSource:
      usage.actualCostUsd !== null
        ? "provider"
        : estimated !== null || usage.estimatedCostUsd !== null
          ? "configured_price_estimate"
          : null,
  };
}
export function chargeFor(
  usage: Usage,
  bound: number,
  maxOutput: number,
  reservedCost: number | null,
  llm: boolean,
): BudgetCharge {
  if (!llm)
    return {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      uncertain: false,
    };
  return {
    calls: 1,
    inputTokens: usage.inputTokens ?? bound,
    outputTokens: usage.outputTokens ?? maxOutput,
    costUsd: usage.costUsd ?? reservedCost,
    uncertain: usage.inputTokens === null || usage.outputTokens === null,
  };
}
