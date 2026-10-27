import { it, expect, afterAll } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { selectedAISettings, selectedExecutor } from "../src/ai/factory.js";
import { GeminiSkillExecutor } from "../src/ai/gemini-executor.js";
import {
  transportSchema,
  encodeTransport,
} from "../src/ai/structured-output.js";
import { OutputValidator, SkillRegistry } from "../src/skills/runtime.js";
import type { SkillName } from "../src/domain/models.js";
import type { ExecutionOptions } from "../src/ai/types.js";
import { ExecutionFailure } from "../src/skills/runner.js";
const dir = mkdtempSync(resolve(".local/gemini-unit-"));
afterAll(() => {
  expect(dir.startsWith(resolve(".local"))).toBe(true);
  rmSync(dir, { recursive: true, force: true });
});
const registry = new SkillRegistry();
const bundle = registry.load("benchmark-researcher");
const options: ExecutionOptions = {
  model: "gemini-3.8-flash",
  workflowClass: "FAST",
  maxOutputTokens: 4096,
  timeoutMs: 1000,
  prepared: {
    skillCore: bundle.instructions,
    relevantReferences: bundle.references,
    taskContext: {},
    structuredInputs: {},
  },
  signal: new AbortController().signal,
};
it("defaults to Gemini profiles and requires explicit AI enablement plus the Gemini key", () => {
  const settings = selectedAISettings({});
  expect(settings.models.FAST).toBe("gemini-3.8-flash");
  expect(settings.enabled).toBe(false);
  expect(() =>
    selectedExecutor(settings, { GEMINI_API_KEY: "test-only" }),
  ).toThrow("ENABLE_REAL_AI");
  settings.enabled = true;
  expect(() => selectedExecutor(settings, {})).toThrow("GEMINI_API_KEY");
  expect(
    selectedExecutor(settings, { GEMINI_API_KEY: "test-only" }).provider,
  ).toBe("gemini");
  expect(
    selectedAISettings({
      AI_PROVIDER: "openai",
      MODEL_FAST: "openai-alternative",
    }).models.FAST,
  ).toBe("openai-alternative");
});
it("fails closed on expired paid prices and accepts an explicit model override", () => {
  const file = join(dir, "expired-prices.json");
  writeFileSync(file, JSON.stringify({ validUntil: "2000-01-01", models: {} }));
  expect(() => selectedAISettings({ GEMINI_PRICING_FILE: file })).toThrow(
    "expired",
  );
  expect(
    selectedAISettings({ GEMINI_MODEL_FAST: "custom-model" }).models.FAST,
  ).toBe("custom-model");
});
it("sends bounded JSON requests through the Gemini SDK contract for every original Skill and accounts for thinking", async () => {
  const validator = new OutputValidator(registry);
  for (const item of readdirSync("skills", { withFileTypes: true }).filter(
    (i) => i.isDirectory(),
  )) {
    const b = registry.load(item.name as SkillName);
    const original = JSON.parse(
      readFileSync(`fixtures/skill-outputs/${item.name}.json`, "utf8"),
    );
    const executor = new GeminiSkillExecutor(
      { ...selectedAISettings({}), enabled: true },
      "test-only",
      async (request) => {
        expect(request.config?.responseJsonSchema).toEqual(
          transportSchema(b.schema),
        );
        expect(request.config?.responseMimeType).toBe("application/json");
        expect(request.config?.tools).toEqual([]);
        expect(request.config?.maxOutputTokens).toBe(4096);
        expect(request.config?.thinkingConfig?.thinkingLevel).toBe("LOW");
        expect(request.config?.httpOptions?.retryOptions?.attempts).toBe(1);
        return {
          text: JSON.stringify(encodeTransport(b.schema, original)),
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 50,
            thoughtsTokenCount: 20,
            cachedContentTokenCount: 0,
            totalTokenCount: 170,
          },
        };
      },
    );
    const receipt = await executor.execute(b, {}, options);
    expect(validator.validate(b.name, receipt.output)).toEqual(original);
    expect(receipt.usage.outputTokens).toBe(70);
    expect(receipt.usage.reasoningTokens).toBe(20);
    expect(receipt.usage.cachedInputTokens).toBe(0);
  }
});
it("rejects truncation/refusal/malformed JSON and retains measured usage without raw provider secrets", async () => {
  const settings = { ...selectedAISettings({}), enabled: true };
  for (const text of ["{}", "not json", ""]) {
    const executor = new GeminiSkillExecutor(
      settings,
      "test-only",
      async () => ({
        text,
        candidates: [{ finishReason: "MAX_TOKENS" as never }],
        usageMetadata: { promptTokenCount: 33 },
      }),
    );
    await expect(executor.execute(bundle, {}, options)).rejects.toMatchObject({
      usage: { inputTokens: 33 },
    });
  }
  const executor = new GeminiSkillExecutor(settings, "test-only", async () => {
    throw { status: 429, message: "private-credential" };
  });
  await expect(executor.execute(bundle, {}, options)).rejects.toMatchObject({
    kind: "retryable_error",
  });
  try {
    await executor.execute(bundle, {}, options);
  } catch (e) {
    expect(e).toBeInstanceOf(ExecutionFailure);
    expect(String(e)).not.toContain("private-credential");
  }
});
it("refuses wrong or changed image bytes before any request", async () => {
  let calls = 0;
  const executor = new GeminiSkillExecutor(
    { ...selectedAISettings({}), enabled: true },
    "test-only",
    async () => {
      calls++;
      return { text: undefined };
    },
  );
  const file = join(dir, "changed.png");
  writeFileSync(file, "changed");
  const visualAssets = [
    {
      assetId: "test",
      path: file,
      mime: "image/png" as const,
      detail: "high" as const,
      sha256: "wrong",
      byteLength: 7,
      width: 1,
      height: 1,
    },
  ];
  await expect(
    executor.execute(
      registry.load("quality-reviewer"),
      {},
      { ...options, prepared: { ...options.prepared, visualAssets } },
    ),
  ).rejects.toThrow("hash changed");
  await expect(
    executor.execute(
      bundle,
      {},
      { ...options, prepared: { ...options.prepared, visualAssets } },
    ),
  ).rejects.toThrow("Only Quality Reviewer");
  expect(calls).toBe(0);
});
