import { describe, it, expect } from "vitest";
import { mkdtempSync, cpSync, appendFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CountingExecutor, countingCM, testAI } from "./ai-helpers.js";
import { runAIDemo, seedVerifiedDemo } from "../src/workflows/demo.js";
import { current, emptyStore, type ContentItem } from "../src/domain/models.js";
import {
  recentSummary,
  editorialSummary,
  selectReferences,
} from "../src/ai/context.js";
import { previewInput } from "../src/ai/preview.js";
import { SkillRegistry, SkillRunner } from "../src/skills/runtime.js";
import { loadConfig } from "../src/config/index.js";
import { loadAISettings } from "../src/ai/config.js";
import { usageReport, sumUsage } from "../src/ai/usage.js";
import { CMError, redact } from "../src/common/core.js";
import { DeterministicQualityGate } from "../src/qa/deterministic-gate.js";
import { BudgetExceeded } from "../src/ai/governance.js";
import { UsageJournal } from "../src/ai/journal.js";
import { createCM, ready } from "./helpers.js";

describe("token and context governance", () => {
  it("1,2,4: verified FAST result executes only four necessary Skills and reads persisted strategy", async () => {
    const executor = new CountingExecutor(),
      { cm } = countingCM(testAI(), executor);
    const c = await runAIDemo(cm);
    expect(c.workflowClass).toBe("FAST");
    expect(executor.calls.map((c) => c.skill)).toEqual([
      "content-opportunity-detector",
      "social-designer",
      "copywriter",
      "quality-reviewer",
    ]);
    expect(c.status).toBe("ready_for_human_approval");
    expect(c.approvals.at(-1)?.state).toBe("pending_approval");
    expect(c.publications).toHaveLength(0);
  });
  it("3: explicit benchmark question is cached inside its TTL", async () => {
    const executor = new CountingExecutor(),
      { cm } = countingCM(testAI(), executor);
    await cm.runBenchmarkResearch("How to make a demo result legible?");
    await cm.runBenchmarkResearch("How to make a demo result legible?");
    expect(executor.calls).toHaveLength(1);
    expect((await cm.repository.read()).benchmarks).toHaveLength(1);
  });
  it("4: weekly strategy is not rerun by individual posts", async () => {
    const executor = new CountingExecutor(),
      { cm } = countingCM(testAI(), executor);
    await cm.runWeeklyStrategyReview();
    await runAIDemo(cm);
    await cm.runWeeklyStrategyReview();
    expect(
      executor.calls.filter((c) => c.skill === "editorial-strategist"),
    ).toHaveLength(1);
  });
  it("5: deterministic reference policy excludes carousel/Story rules from a simple graphic", () => {
    const names = selectReferences("social-designer", {
      format: "single_image",
    });
    expect(names).not.toContain("carousel-architecture.md");
    expect(
      selectReferences("social-designer", { format: "carousel" }),
    ).toContain("carousel-architecture.md");
    expect(
      selectReferences("copywriter", { format: "single_image" }),
    ).not.toContain("platform-adaptation.md");
  });
  it("6,7: identical inputs cache; changing selected reference, Skill or model invalidates it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "polo-skill-policy-"));
    try {
      cpSync("skills/benchmark-researcher", join(dir, "benchmark-researcher"), {
        recursive: true,
      });
      const registry = new SkillRegistry(dir),
        executor = new CountingExecutor(),
        ai = testAI(),
        store = emptyStore();
      let runner = new SkillRunner(registry, executor, loadConfig({}), ai);
      await runner.run(store, "benchmark-researcher", {});
      await runner.run(store, "benchmark-researcher", {});
      expect(executor.calls).toHaveLength(1);
      ai.models.PREMIUM = "test-other";
      runner = new SkillRunner(registry, executor, loadConfig({}), ai);
      await runner.run(store, "benchmark-researcher", {});
      expect(executor.calls).toHaveLength(2);
      appendFileSync(
        join(dir, "benchmark-researcher/references/analysis-framework.md"),
        "\nUpdated relevant guidance.",
      );
      await runner.run(store, "benchmark-researcher", {});
      expect(executor.calls).toHaveLength(3);
      appendFileSync(
        join(dir, "benchmark-researcher/SKILL.md"),
        "\nNew core constraint.",
      );
      await runner.run(store, "benchmark-researcher", {});
      expect(executor.calls).toHaveLength(4);
      appendFileSync(
        join(dir, "benchmark-researcher/references/platform-state-2026.md"),
        "\nIrrelevant to this request.",
      );
      await runner.run(store, "benchmark-researcher", {});
      expect(executor.calls).toHaveLength(4);
    } finally {
      expect(resolve(dir).startsWith(resolve(tmpdir()))).toBe(true);
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("8,9,23: exhausted calls block before QA, preserve facts and never allow approval or publication", async () => {
    const ai = testAI();
    ai.classes.FAST.maxCalls = 3;
    const executor = new CountingExecutor(),
      { cm } = countingCM(ai, executor);
    await expect(runAIDemo(cm)).rejects.toBeInstanceOf(BudgetExceeded);
    const s = await cm.repository.read(),
      c = Object.values(s.contents)[0]!;
    expect(c.status).toBe("blocked");
    expect(c.blockers[0]?.code).toBe("blocked_budget");
    expect(executor.calls).toHaveLength(3);
    expect(c.approvals).toHaveLength(0);
    expect(current(c.copies)).toBeTruthy();
    await expect(cm.simulatePublish(c.id)).rejects.toThrow();
    expect(Object.values(s.events)[0]?.data.claims[0]?.claim).toContain(
      "12-10",
    );
  });
  it("10: ledger aggregates tokens, cached tokens, configured cost, day, model, Skill and workflow", async () => {
    const { cm } = countingCM();
    await runAIDemo(cm);
    const report = usageReport(await cm.repository.read());
    expect(report.totals.inputTokens).toBe(400);
    expect(report.totals.cachedInputTokens).toBe(160);
    expect(report.totals.outputTokens).toBe(200);
    expect(report.totals.totalTokens).toBe(600);
    expect(report.totals.estimatedCostUsd).toBeCloseTo(0.00072);
    expect(report.totals.actualCostUsd).toBeNull();
    expect(report.byDay).toHaveLength(1);
    expect(report.bySkill).toHaveLength(4);
    expect(report.byClass[0]?.key).toBe("FAST");
  });
  it("11: missing measured usage is null and is not replaced by the estimate", async () => {
    const cm = createCM();
    await cm.runDailyDiscovery();
    const s = await cm.repository.read();
    expect(s.runs[0]?.usage?.inputTokens).toBeNull();
    expect(sumUsage(s.runs).totalTokens).toBeNull();
    expect(s.runs[0]?.estimatedInputTokens).toBeGreaterThan(0);
  });
  it("12: score contradiction is detected before any editorial QA executor call", async () => {
    const executor = new CountingExecutor(),
      { cm } = countingCM(testAI(), executor);
    const c = await runAIDemo(cm),
      copy = structuredClone(current(c.copies)!.data);
    copy.outputs.caption = "Team Azul ganó 14-10";
    await cm.reviseContent(c.id, { copy }, "Fixture editor");
    const before = executor.calls.length;
    const qa = await cm.runQualityReview(c.id);
    expect(qa.status).toBe("qa_failed");
    expect(qa.blockers[0]?.code).toBe("score_mismatch");
    expect(executor.calls).toHaveLength(before);
  });
  it("13,14: recent content is bounded and repeated events/subjects/hooks/CTA generate saturation signals", async () => {
    const { cm } = countingCM();
    await seedVerifiedDemo(cm);
    const s = await cm.repository.read(),
      base = Object.values(s.contents)[0]!;
    for (let i = 0; i < 100; i++)
      s.contents["repeat-" + i] = {
        ...structuredClone(base),
        id: "repeat-" + i,
        createdAt: new Date().toISOString(),
      };
    const summary = recentSummary(s, testAI());
    expect(summary.recent).toHaveLength(20);
    expect(summary.totalInWindow).toBe(101);
    expect(
      summary.saturationSignals.some((x) => x.dimension === "eventId"),
    ).toBe(true);
    const context = editorialSummary(s, testAI()) as {
      recentContent: { recent: unknown[] };
    };
    expect(context.recentContent.recent).toHaveLength(20);
  });
  it("15,16,17: real AI defaults false, missing key leaves fixture mode usable and never enables publishing", async () => {
    expect(loadAISettings({}).enabled).toBe(false);
    expect(loadAISettings({ ENABLE_REAL_AI: "true" }).enabled).toBe(true);
    expect(
      Object.values(loadConfig({ ENABLE_REAL_AI: "true" }).flags).every(
        (v) => v === false,
      ),
    ).toBe(true);
    const c = await ready(createCM());
    expect(c.status).toBe("ready_for_human_approval");
  });
  it("18: secret redaction preserves usage measurements", () => {
    const old = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "unit-secret-credential";
    try {
      expect(
        redact({
          inputTokens: 100,
          outputTokens: 20,
          totalTokens: 120,
          apiKey: process.env.OPENAI_API_KEY,
          api_key_configured: false,
          error: "failed " + process.env.OPENAI_API_KEY,
        }),
      ).toEqual({
        inputTokens: 100,
        outputTokens: 20,
        totalTokens: 120,
        apiKey: "[REDACTED]",
        api_key_configured: false,
        error: "failed [REDACTED]",
      });
    } finally {
      if (old === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = old;
    }
  });
  it("19: context preview selects model, references, reasons and budget without executing a Skill", async () => {
    const executor = new CountingExecutor(),
      { cm } = countingCM(testAI(), executor);
    await seedVerifiedDemo(cm);
    const s = await cm.repository.read(),
      c = Object.values(s.contents)[0]!;
    const preview = cm.runner.preview(
      s,
      "content-opportunity-detector",
      previewInput(s, c, "content-opportunity-detector", cm.runner),
      c.id,
    );
    expect(preview.model).toBe("test-fast");
    expect(preview.estimatedInputTokens).toBeGreaterThan(0);
    expect(preview.reason).toBeTruthy();
    expect(executor.calls).toHaveLength(0);
  });
  it("20: a second identical AI demo performs zero additional calls and records four cache hits", async () => {
    const executor = new CountingExecutor(),
      { cm } = countingCM(testAI(), executor);
    await runAIDemo(cm);
    const before = (await cm.repository.read()).audit.length;
    await runAIDemo(cm);
    const s = await cm.repository.read();
    expect(executor.calls).toHaveLength(4);
    expect(
      s.audit.slice(before).filter((a) => a.kind === "skill_cache_hit"),
    ).toHaveLength(4);
  });
  it("21: retry counts against the same call budget", async () => {
    const ai = testAI();
    ai.classes.FAST.maxCalls = 1;
    let calls = 0;
    const executor = {
      name: "transient",
      version: "1",
      model: null,
      usesLLM: true,
      execute: async () => {
        calls++;
        throw new CMError("retryable_error", "temporary");
      },
    };
    const { cm } = countingCM(ai, executor);
    await expect(runAIDemo(cm)).rejects.toBeInstanceOf(BudgetExceeded);
    expect(calls).toBe(1);
    expect(
      Object.values((await cm.repository.read()).contents)[0]?.blockers[0]
        ?.code,
    ).toBe("blocked_budget");
  });
  it("22: premium has a larger explicit budget than FAST", () => {
    const c = testAI();
    expect(c.classes.PREMIUM.maxCalls).toBeGreaterThan(c.classes.FAST.maxCalls);
    expect(c.classes.PREMIUM.maxInputTokens).toBeGreaterThan(
      c.classes.FAST.maxInputTokens,
    );
    expect(c.classes.PREMIUM.maxCostUsd!).toBeGreaterThan(
      c.classes.FAST.maxCostUsd!,
    );
  });
  it("input budget cannot truncate central facts to fit", async () => {
    const ai = testAI();
    ai.classes.FAST.maxInputTokens = 1;
    const executor = new CountingExecutor(),
      { cm } = countingCM(ai, executor);
    await expect(runAIDemo(cm)).rejects.toBeInstanceOf(BudgetExceeded);
    expect(executor.calls).toHaveLength(0);
    expect(
      Object.values((await cm.repository.read()).events)[0]?.data.claims,
    ).toHaveLength(1);
  });
  it("unknown prices block a paid call with a dollar cap", async () => {
    const ai = testAI();
    ai.pricing.models = {};
    const executor = new CountingExecutor(),
      { cm } = countingCM(ai, executor);
    await expect(runAIDemo(cm)).rejects.toThrow("Price configuration");
    expect(executor.calls).toHaveLength(0);
  });
  it("a write-ahead reservation survives restart and prevents a duplicate paid attempt after a crash", () => {
    const dir = mkdtempSync(join(tmpdir(), "polo-usage-"));
    try {
      const journal = new UsageJournal(join(dir, "usage.jsonl")),
        limits = {
          maxCalls: 1,
          maxInputTokens: 1000,
          maxOutputTokens: 1000,
          maxCostUsd: 1,
        };
      journal.reserve(
        {
          id: "pending",
          workflowId: "wf",
          phase: "reserved",
          budgetCharge: {
            calls: 1,
            inputTokens: 100,
            outputTokens: 100,
            costUsd: 0.1,
            uncertain: true,
          },
        },
        emptyStore(),
        limits,
      );
      const restarted = new UsageJournal(join(dir, "usage.jsonl"));
      expect(() =>
        restarted.reserve(
          {
            id: "second",
            workflowId: "wf",
            phase: "reserved",
            budgetCharge: {
              calls: 1,
              inputTokens: 100,
              outputTokens: 100,
              costUsd: 0.1,
              uncertain: true,
            },
          },
          emptyStore(),
          limits,
        ),
      ).toThrow("exhausted");
    } finally {
      expect(resolve(dir).startsWith(resolve(tmpdir()))).toBe(true);
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("deterministic QA checks required asset IDs and version staleness", async () => {
    const { cm } = countingCM();
    const c = await runAIDemo(cm),
      s = await cm.repository.read(),
      event = Object.values(s.events)[0]!.data;
    const modified = structuredClone(c) as ContentItem;
    current(modified.plans)!.stale = true;
    expect(
      new DeterministicQualityGate(cm.runner.validator).inspect(
        s,
        modified,
        event,
      ).passed,
    ).toBe(false);
  });
});
