import { canonical, CMError, hash, id, now, redact } from "../common/core.js";
import type { Config } from "../config/index.js";
import type {
  SkillName,
  SkillOutputs,
  Store,
  WorkflowRun,
} from "../domain/models.js";
import { loadAISettings } from "../ai/config.js";
import {
  classFor,
  remainingBudget,
  estimateCost,
  chargeFor,
  withCost,
  BudgetExceeded,
} from "../ai/governance.js";
import { preparedContext, selectReferences } from "../ai/context.js";
import {
  unknownUsage,
  type AISettings,
  type ExecutionPlan,
  type ExecutionReceipt,
  type Usage,
} from "../ai/types.js";
import { transportSchema } from "../ai/structured-output.js";
import { UsageJournal } from "../ai/journal.js";
import {
  OutputValidator,
  SkillRegistry,
  type SkillInput,
  type SkillExecutor,
} from "./runtime.js";

export class ExecutionFailure extends CMError {
  constructor(
    kind: ConstructorParameters<typeof CMError>[0],
    message: string,
    readonly usage: Usage = unknownUsage(),
  ) {
    super(kind, message);
  }
}
function receipt(value: unknown): value is ExecutionReceipt {
  return (
    !!value &&
    typeof value === "object" &&
    (value as { kind?: unknown }).kind === "skill_execution"
  );
}
export class SkillRunner {
  readonly validator: OutputValidator;
  readonly isLive: boolean;
  private journal: UsageJournal | undefined;
  constructor(
    private registry: SkillRegistry,
    private executor: SkillExecutor,
    private config: Config,
    readonly ai: AISettings = loadAISettings(),
  ) {
    this.validator = new OutputValidator(registry);
    this.isLive = executor.live === true;
    this.journal = this.isLive ? new UsageJournal() : undefined;
  }
  preview(
    store: Store,
    skill: SkillName,
    input: SkillInput,
    contentId: string | null = null,
  ): ExecutionPlan {
    const references = selectReferences(skill, input),
      bundle = this.registry.load(skill, references);
    const workflowClass = classFor(skill, store, contentId),
      limits = this.ai.classes[workflowClass];
    const skillLimits = {
      ...this.ai.perSkill.default,
      ...this.ai.perSkill[skill],
    };
    const modelProfile = skillLimits.modelProfile ?? workflowClass;
    const model = this.executor.usesLLM
      ? this.ai.models[modelProfile]
      : this.executor.model;
    const prepared = preparedContext(
      skill,
      input,
      bundle.instructions,
      bundle.references,
    );
    const wireBytes = Buffer.byteLength(
      canonical({ prepared, schema: transportSchema(bundle.schema) }),
      "utf8",
    );
    // UTF-8 byte count is an upper reservation, not a claim of observed model usage.
    const imageReserve = (prepared.visualAssets ?? []).reduce(
      (sum, image) => sum + image.byteLength + 16384,
      0,
    );
    const inputTokenUpperBound = wireBytes + 2048 + imageReserve;
    const estimatedInputTokens = Math.ceil(wireBytes / 3.2) + 128;
    const workflowId =
      input.workflowId ??
      (contentId
        ? `content:${contentId}`
        : `task:${skill}:${hash({ inputs: prepared.structuredInputs, context: prepared.taskContext })}`);
    const remaining = remainingBudget(
      store,
      workflowId,
      limits,
      this.journal?.rows(),
    );
    const maxOutputTokens = Math.min(
      skillLimits.maxOutputTokens ?? 4096,
      remaining.maxOutputTokens,
    );
    const inputHash = hash({
      skill,
      prepared,
      knowledge: bundle.fingerprint,
      executor: this.executor.name,
      version: this.executor.version,
      model,
      profile: modelProfile,
      mode: this.config.mode,
      contextPolicy: this.ai.version,
      maxOutputTokens: skillLimits.maxOutputTokens ?? 4096,
    });
    const cacheHit = store.runs.some(
      (r) => r.inputHash === inputHash && r.status === "success",
    );
    const reservedCost = estimateCost(
      this.ai,
      model,
      inputTokenUpperBound,
      maxOutputTokens,
    );
    let budgetIssue: string | null = null;
    if (this.executor.usesLLM && !cacheHit) {
      if (!model)
        budgetIssue = `Model profile ${modelProfile} is not configured`;
      else if (remaining.maxCalls < 1) budgetIssue = "maxCalls exhausted";
      else if (
        inputTokenUpperBound > remaining.maxInputTokens ||
        inputTokenUpperBound > (skillLimits.maxInputTokens ?? 50000)
      )
        budgetIssue =
          "Input context cannot fit the remaining budget without dropping required information";
      else if (maxOutputTokens < (skillLimits.maxOutputTokens ?? 4096))
        budgetIssue =
          "Insufficient output budget for a complete validated response";
      else if (remaining.maxCostUsd !== null && reservedCost === null)
        budgetIssue = "Price configuration required to enforce maxCostUsd";
      else if (
        remaining.maxCostUsd !== null &&
        reservedCost !== null &&
        reservedCost > remaining.maxCostUsd
      )
        budgetIssue = "maxCostUsd reservation exceeds remaining budget";
      const scope = this.ai.automationScope;
      if (scope) {
        const rows = store.runs.filter(
          (r) =>
            r.llmCall && Date.parse(r.startedAt) >= Date.parse(scope.startedAt),
        );
        const cost = rows.reduce(
          (sum, r) => sum + (r.budgetCharge?.costUsd ?? 0),
          0,
        );
        if (rows.length >= scope.maxCalls)
          budgetIssue = "Automation cycle maxCalls exhausted";
        else if (
          reservedCost === null ||
          cost + reservedCost > scope.maxCostUsd
        )
          budgetIssue = "Automation cycle cost reservation exceeds budget";
      }
    }
    return {
      skill,
      model,
      modelProfile,
      workflowClass,
      workflowId,
      reason:
        input.reason ?? `Required ${skill} decision for this workflow stage`,
      references,
      contextBytes: wireBytes,
      estimatedInputTokens,
      inputTokenUpperBound,
      imageCount: prepared.visualAssets?.length ?? 0,
      imageInputReservation: imageReserve,
      imageTokenEstimate: null,
      maxOutputTokens,
      inputHash,
      cacheHit,
      remaining,
      budgetIssue,
      prepared,
    };
  }
  async run<K extends SkillName>(
    store: Store,
    skill: K,
    input: SkillInput,
    contentId: string | null = null,
    force = false,
  ): Promise<SkillOutputs[K]> {
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      const plan = this.preview(store, skill, input, contentId);
      const previous = store.runs.findLast(
        (r) => r.inputHash === plan.inputHash && r.status === "success",
      );
      if (previous && !force) {
        store.audit.push({
          id: id("audit"),
          contentId,
          kind: "skill_cache_hit",
          at: now(),
          detail: {
            skill,
            runId: previous.id,
            inputHash: plan.inputHash,
            workflowId: plan.workflowId,
            reason: plan.reason,
          },
        });
        return structuredClone(previous.output) as SkillOutputs[K];
      }
      // Force never bypasses budget checks, including after a cache entry expires.
      if (force && this.executor.usesLLM && plan.cacheHit) {
        const uncached = {
          ...store,
          runs: store.runs.map((r) =>
            r.inputHash === plan.inputHash
              ? { ...r, status: "error" as const }
              : r,
          ),
        };
        plan.budgetIssue = this.preview(
          uncached,
          skill,
          input,
          contentId,
        ).budgetIssue;
      }
      if (plan.budgetIssue)
        throw new BudgetExceeded(plan.budgetIssue, contentId, plan.workflowId);
      const bundle = this.registry.load(skill, plan.references),
        started = Date.now(),
        startedAt = now();
      let usage = unknownUsage(),
        raw: unknown = null,
        actualModel = plan.model,
        apiLatencyMs = 0;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const reservedCost = estimateCost(
        this.ai,
        plan.model,
        plan.inputTokenUpperBound,
        plan.maxOutputTokens,
      );
      const runId = id("run");
      const reservation = {
        id: runId,
        workflowId: plan.workflowId,
        budgetCharge: chargeFor(
          unknownUsage(),
          plan.inputTokenUpperBound,
          plan.maxOutputTokens,
          reservedCost,
          this.executor.usesLLM === true,
        ),
      };
      if (this.executor.usesLLM) {
        try {
          this.journal?.reserve(
            { ...reservation, phase: "reserved" },
            store,
            this.ai.classes[plan.workflowClass],
          );
        } catch (e) {
          throw new BudgetExceeded(
            e instanceof Error ? e.message : "Usage reservation failed",
            contentId,
            plan.workflowId,
          );
        }
        (store.budgetReservations ??= []).push(reservation);
      }
      const save = (status: "success" | "error", error: CMError | null) => {
        usage = withCost(usage, this.ai, plan.model);
        const row: WorkflowRun = {
          id: runId,
          skill,
          contentId,
          inputHash: plan.inputHash,
          knowledgeHash: bundle.fingerprint,
          input: redact(plan.prepared),
          output: status === "success" ? redact(raw) : null,
          startedAt,
          endedAt: now(),
          durationMs: Date.now() - started,
          status,
          attempt,
          executor: this.executor.name,
          model: actualModel,
          configuration: redact({
            mode: this.config.mode,
            modelProfile: plan.modelProfile,
            policyVersion: this.ai.version,
            pricingVersion: this.ai.pricing.version,
          }),
          error: error
            ? { kind: error.kind, message: String(redact(error.message)) }
            : null,
          workflowId: plan.workflowId,
          workflowClass: plan.workflowClass,
          provider: this.executor.provider ?? null,
          llmCall: this.executor.usesLLM === true,
          usage,
          estimatedInputTokens: plan.estimatedInputTokens,
          latencyMs: apiLatencyMs || Date.now() - started,
          budgetCharge: chargeFor(
            usage,
            plan.inputTokenUpperBound,
            plan.maxOutputTokens,
            reservedCost,
            this.executor.usesLLM === true,
          ),
          selectedReferences: plan.references,
          reason: plan.reason,
        };
        store.budgetReservations = store.budgetReservations?.filter(
          (r) => r.id !== runId,
        );
        store.runs.push(row);
        try {
          this.journal?.settle({
            id: runId,
            workflowId: plan.workflowId,
            budgetCharge: row.budgetCharge!,
            phase: "settled",
            usage,
          });
        } catch {
          throw new BudgetExceeded(
            "Paid usage is conservatively reserved; journal settlement needs review",
            contentId,
            plan.workflowId,
          );
        }
      };
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(
              new ExecutionFailure(
                "retryable_error",
                "Skill execution timed out",
              ),
            );
          }, this.ai.timeoutMs);
        });
        const value = await Promise.race([
          this.executor.execute(bundle, structuredClone(input), {
            model: plan.model,
            workflowClass: plan.workflowClass,
            maxOutputTokens: plan.maxOutputTokens,
            timeoutMs: this.ai.timeoutMs,
            prepared: plan.prepared,
            signal: this.ai.automationScope?.signal
              ? AbortSignal.any([
                  controller.signal,
                  this.ai.automationScope.signal,
                ])
              : controller.signal,
          }),
          timeout,
        ]);
        apiLatencyMs = Date.now() - started;
        if (receipt(value)) {
          raw = value.output;
          usage = value.usage;
          actualModel = value.model ?? plan.model;
        } else raw = value;
        const output = this.validator.validate(skill, raw);
        save("success", null);
        const known = new Set(store.runs.map((r) => r.id));
        const charges = [
          ...store.runs,
          ...(this.journal?.rows() ?? []).filter((r) => !known.has(r.id)),
        ]
          .filter((r) => r.workflowId === plan.workflowId)
          .map((r) => r.budgetCharge)
          .filter((r): r is NonNullable<typeof r> => !!r);
        const total = charges.reduce(
          (a, b) => ({
            calls: a.calls + b.calls,
            input: a.input + b.inputTokens,
            output: a.output + b.outputTokens,
            cost: a.cost + (b.costUsd ?? 0),
          }),
          { calls: 0, input: 0, output: 0, cost: 0 },
        );
        const cap = this.ai.classes[plan.workflowClass];
        if (
          this.executor.usesLLM &&
          (total.calls > cap.maxCalls ||
            total.input > cap.maxInputTokens ||
            total.output > cap.maxOutputTokens ||
            (cap.maxCostUsd !== null && total.cost > cap.maxCostUsd + 1e-9))
        )
          throw new BudgetExceeded(
            "Reported usage exceeded the reserved budget; human review required",
            contentId,
            plan.workflowId,
          );
        return output;
      } catch (cause) {
        if (cause instanceof BudgetExceeded) throw cause;
        const error =
          cause instanceof CMError
            ? cause
            : new CMError("provider_error", "Skill provider failed");
        if (cause instanceof ExecutionFailure) usage = cause.usage;
        save("error", error);
        store.audit.push({
          id: id("audit"),
          contentId,
          kind: "workflow_error",
          at: now(),
          detail: {
            skill,
            kind: error.kind,
            message: redact(error.message),
            attempt,
            workflowId: plan.workflowId,
          },
        });
        if (
          error.kind !== "retryable_error" ||
          attempt === this.config.maxRetries
        )
          throw error;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    throw new CMError("permanent_error", "Retry budget exhausted");
  }
}
