import { describe, expect, it } from "vitest";
import { current, emptyStore, type SkillName } from "../src/domain/models.js";
import { canTransition, ownerFor } from "../src/domain/state-machine.js";
import { loadConfig, dangerousFlags } from "../src/config/index.js";
import { canonical, CMError, hash, redact } from "../src/common/core.js";
import { FixtureSkillExecutor } from "../src/skills/fixture-executor.js";
import {
  CallbackSkillExecutor,
  OutputValidator,
  SkillRegistry,
  SkillRunner,
} from "../src/skills/runtime.js";
import { createCM, ready, approved } from "./helpers.js";
import { packageHash } from "../src/approvals/service.js";
import { assertRights } from "../src/domain/guards.js";

describe("domain guards, contracts, execution and retries", () => {
  it("state machine forbids skipping QA/approval and leaving archive", () => {
    expect(canTransition("detected", "published")).toBe(false);
    expect(canTransition("ready_for_qa", "human_approved")).toBe(false);
    expect(canTransition("archived", "planning")).toBe(false);
    expect(canTransition("human_approved", "ready_to_publish")).toBe(true);
  });
  it("routes verification, rights, strategy and copy to distinct owners", () => {
    expect(ownerFor("blocked_verification", "reel")).toBe(
      "polo-news-researcher",
    );
    expect(ownerFor("blocked_rights", "reel")).toBe("asset-rights-owner");
    expect(ownerFor("replan_required", "single_image")).toBe(
      "content-opportunity-detector",
    );
    expect(ownerFor("copy", "reel")).toBe("copywriter");
  });
  it("all dangerous flags are false and enabling any fails closed", () => {
    const c = loadConfig({});
    expect(Object.values(c.flags).every((x) => x === false)).toBe(true);
    for (const flag of dangerousFlags.filter(
      (f) => f !== "ENABLE_REAL_PUBLISHING",
    ))
      expect(() => loadConfig({ [flag]: "true" })).toThrow(flag);
    expect(loadConfig({ ENABLE_REAL_PUBLISHING: "true" }).mode).toBe("mock");
    expect(() => loadConfig({ MAX_SKILL_RETRIES: "1000" })).toThrow();
  });
  it("hashes object keys deterministically; redacts nested secrets", () => {
    expect(hash({ a: 1, b: 2 })).toBe(hash({ b: 2, a: 1 }));
    expect(canonical([1, 2])).not.toBe(canonical([2, 1]));
    expect(
      redact({
        apiKey: "sensitive",
        context: { password: "sensitive", note: "Bearer abc" },
      }),
    ).toEqual({
      apiKey: "[REDACTED]",
      context: { password: "[REDACTED]", note: "Bearer [REDACTED]" },
    });
  });
  it("every original JSON Schema validates its demo output; malformed outputs fail", async () => {
    const registry = new SkillRegistry(),
      validator = new OutputValidator(registry),
      executor = new FixtureSkillExecutor();
    const { readFileSync } = await import("node:fs");
    for (const name of [
      "benchmark-researcher",
      "polo-news-researcher",
      "content-opportunity-detector",
      "editorial-strategist",
      "reel-planner",
      "social-designer",
      "copywriter",
      "quality-reviewer",
      "performance-analyst",
    ] as SkillName[]) {
      const record = JSON.parse(
        readFileSync(`fixtures/skill-outputs/${name}.json`, "utf8"),
      ) as unknown;
      expect(validator.validate(name, record)).toEqual(record);
      expect(() => validator.validate(name, {})).toThrow(CMError);
      expect(registry.load(name).references).not.toEqual({});
    }
    expect(executor.model).toBeNull();
  });
  it("behavioral validator rejects schema-valid passing QA with a major issue", () => {
    const validator = new OutputValidator(new SkillRegistry());
    expect(() =>
      validator.validate("quality-reviewer", {
        review_id: "r",
        content_id: "c",
        review_stage: "post_render",
        review_mode: "full",
        decision: "pass_for_human_approval",
        scope: {
          surfaces_reviewed: [],
          available_inputs: [],
          missing_inputs: [],
        },
        versions: {},
        source_of_truth: [],
        issues: [
          {
            issue_id: "i",
            severity: "major",
            category: "copy",
            surface: "caption",
            problem: "x",
            impact: "x",
            owner: "copywriter",
            required_fix: "x",
            recheck_scope: ["copy"],
            status: "open",
          },
        ],
        checks: {
          facts: "pass",
          editorial_alignment: "pass",
          copy: "pass",
          visual_or_video: "pass",
          authenticity: "pass",
          originality: "pass",
          rights: "pass",
          sponsor_compliance: "pass",
          accessibility: "pass",
          platform_preflight: "pass",
          timing: "pass",
          brand_integrity: "pass",
        },
        approval: { state: "required_pending" },
        observed_at: "2026-10-24",
      }),
    ).toThrow("open majors");
  });
  it("only explicitly retryable failures retry, with bounded attempts and durable traces", async () => {
    let attempts = 0;
    const executor = new CallbackSkillExecutor(
      "failure",
      "1",
      null,
      async () => {
        attempts++;
        throw new CMError("retryable_error", "temporary");
      },
    );
    const cm = createCM(undefined, executor);
    await expect(cm.runDailyDiscovery()).rejects.toThrow("temporary");
    const s = await cm.repository.read();
    expect(attempts).toBe(3);
    expect(s.runs).toHaveLength(3);
    expect(s.runs.every((r) => r.status === "error")).toBe(true);
    expect(s.strategies).toHaveLength(0);
  });
  it("validation failures never retry and preserve error classification", async () => {
    const cm = createCM(
      undefined,
      new CallbackSkillExecutor("invalid", "1", null, async () => ({})),
    );
    await expect(cm.runDailyDiscovery()).rejects.toThrow();
    const s = await cm.repository.read();
    expect(s.runs).toHaveLength(1);
    expect(s.runs[0]?.error?.kind).toBe("validation_error");
  });
  it("cache binds executor version and knowledge fingerprint", async () => {
    const s = emptyStore(),
      registry = new SkillRegistry();
    const runner = new SkillRunner(
      registry,
      new FixtureSkillExecutor(),
      loadConfig({}),
    );
    await runner.run(s, "benchmark-researcher", {});
    await runner.run(s, "benchmark-researcher", {});
    expect(s.runs).toHaveLength(1);
    expect(s.audit[0]?.kind).toBe("skill_cache_hit");
    const second = new FixtureSkillExecutor();
    Object.defineProperty(second, "version", { value: "2" });
    await new SkillRunner(registry, second, loadConfig({})).run(
      s,
      "benchmark-researcher",
      {},
    );
    expect(s.runs).toHaveLength(2);
  });
  it("platform-only, reference-only, unknown and restricted rights cannot publish", async () => {
    const cm = createCM();
    const c = await ready(cm);
    for (const rights of [
      "platform_only",
      "editorial_reference_only",
      "rights_unknown",
      "restricted",
    ] as const) {
      const modified = structuredClone(c);
      current(modified.assets)!.data[0]!.rights = rights;
      expect(() => assertRights(modified)).toThrow("blocked_rights");
    }
  });
  it("no-op edits retain approval; asset or sponsor metadata edits invalidate it", async () => {
    const cm = createCM();
    const c = await approved(cm);
    const same = await cm.reviseContent(
      c.id,
      { copy: current(c.copies)!.data },
      "Editor",
    );
    expect(packageHash(same)).toBe(packageHash(c));
    expect(same.approvals[0]?.invalidatedAt).toBeUndefined();
    const changed = await cm.reviseContent(
      c.id,
      { metadata: { sponsor: "Sponsor ficticio" } },
      "Editor",
    );
    expect(changed.approvals[0]?.invalidatedAt).toBeTruthy();
    expect(current(changed.plans)?.stale).toBe(true);
    await expect(cm.simulatePublish(c.id)).rejects.toThrow();
  });
  it("changes_requested records actor and blocks publishing until rework", async () => {
    const cm = createCM();
    const c = await ready(cm);
    const rejected = await cm.rejectContent(
      c.id,
      "Editor",
      packageHash(c),
      "Ajustar enfoque",
      true,
    );
    expect(rejected.status).toBe("human_rejected");
    expect(rejected.approvals[0]?.state).toBe("changes_requested");
    await expect(cm.simulatePublish(c.id)).rejects.toThrow();
  });
});
