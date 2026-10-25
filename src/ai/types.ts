import type { SkillName } from "../domain/models.js";
export type WorkflowClass = "FAST" | "STANDARD" | "PREMIUM";
export interface BudgetLimits {
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCostUsd: number | null;
}
export interface SkillLimits {
  maxInputTokens: number;
  maxOutputTokens: number;
  modelProfile?: WorkflowClass;
}
export interface ModelPrice {
  input: number;
  cachedInput: number;
  output: number;
}
export interface AISettings {
  enabled: boolean;
  models: Record<WorkflowClass, string | null>;
  version: string;
  timeoutMs: number;
  classes: Record<WorkflowClass, BudgetLimits>;
  perSkill: Record<string, Partial<SkillLimits>>;
  context: {
    recentDays: number;
    maxRecent: number;
    maxLearnings: number;
    maxBenchmarks: number;
  };
  benchmarkTtlHours: number;
  strategyTtlHours: number;
  pricing: { version: string; models: Record<string, ModelPrice> };
}
export interface Usage {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  actualCostUsd: number | null;
  estimatedCostUsd: number | null;
  costUsd: number | null;
  costSource: "provider" | "configured_price_estimate" | null;
}
export const unknownUsage = (): Usage => ({
  inputTokens: null,
  cachedInputTokens: null,
  outputTokens: null,
  reasoningTokens: null,
  totalTokens: null,
  actualCostUsd: null,
  estimatedCostUsd: null,
  costUsd: null,
  costSource: null,
});
export interface ExecutionReceipt {
  kind: "skill_execution";
  output: unknown;
  usage: Usage;
  provider: string;
  model: string | null;
}
export interface PreparedContext {
  visualAssets?: import("../render/visual-input.js").VisualInput[];
  skillCore: string;
  relevantReferences: Record<string, string>;
  taskContext: unknown;
  structuredInputs: unknown;
}
export interface ExecutionOptions {
  model: string | null;
  workflowClass: WorkflowClass;
  maxOutputTokens: number;
  timeoutMs: number;
  prepared: PreparedContext;
  signal: AbortSignal;
}
export interface BudgetCharge {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  uncertain: boolean;
}
export interface ExecutionPlan {
  skill: SkillName;
  model: string | null;
  modelProfile: WorkflowClass;
  workflowClass: WorkflowClass;
  workflowId: string;
  reason: string;
  references: string[];
  contextBytes: number;
  estimatedInputTokens: number;
  inputTokenUpperBound: number;
  imageCount: number;
  imageInputReservation: number;
  imageTokenEstimate: null;
  maxOutputTokens: number;
  inputHash: string;
  cacheHit: boolean;
  remaining: BudgetLimits;
  budgetIssue: string | null;
  prepared: PreparedContext;
}
