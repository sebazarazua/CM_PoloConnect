import { it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import Ajv from "ajv/dist/2020.js";
import { SkillRegistry, OutputValidator } from "../src/skills/runtime.js";
import type { SkillName } from "../src/domain/models.js";
import {
  transportSchema,
  encodeTransport,
  decodeTransport,
} from "../src/ai/structured-output.js";
import {
  OpenAIResponsesSkillExecutor,
  responseUsage,
} from "../src/ai/openai-executor.js";
import { testAI } from "./ai-helpers.js";
import { unknownUsage, type ExecutionOptions } from "../src/ai/types.js";
import { ExecutionFailure } from "../src/skills/runner.js";

it("strict transport schemas round-trip all nine original outputs, including arbitrary dictionaries and extensions", () => {
  const registry = new SkillRegistry(),
    validator = new OutputValidator(registry),
    ajv = new Ajv.default({ strict: false, allErrors: true });
  for (const folder of readdirSync("skills", { withFileTypes: true }).filter(
    (x) => x.isDirectory(),
  )) {
    const name = folder.name as SkillName,
      original = JSON.parse(
        readFileSync(`fixtures/skill-outputs/${name}.json`, "utf8"),
      ) as unknown;
    const schema = registry.load(name).schema,
      wire = encodeTransport(schema, original),
      check = ajv.compile(transportSchema(schema));
    expect(check(wire), JSON.stringify(check.errors)).toBe(true);
    const decoded = decodeTransport(schema, wire);
    expect(decoded).toEqual(original);
    expect(validator.validate(name, decoded)).toEqual(original);
  }
});
it("real executor requires both an explicit enable flag and a key", () => {
  const ai = testAI();
  expect(() => new OpenAIResponsesSkillExecutor(ai, "unit-key")).toThrow(
    "ENABLE_REAL_AI",
  );
  ai.enabled = true;
  expect(() => new OpenAIResponsesSkillExecutor(ai, "")).toThrow(
    "OPENAI_API_KEY",
  );
});
it("official Responses request has strict schema, no tools, no stored response, bounded output and disabled truncation", async () => {
  const ai = testAI();
  ai.enabled = true;
  const registry = new SkillRegistry(),
    bundle = registry.load("benchmark-researcher");
  const original = JSON.parse(
    readFileSync("fixtures/skill-outputs/benchmark-researcher.json", "utf8"),
  ) as unknown;
  let calls = 0;
  const executor = new OpenAIResponsesSkillExecutor(
    ai,
    "unit-key",
    async (body) => {
      calls++;
      expect(body.store).toBe(false);
      expect(body.tools).toEqual([]);
      expect(body.tool_choice).toBe("none");
      expect(body.truncation).toBe("disabled");
      expect(body.max_output_tokens).toBe(4096);
      expect(body.text?.format?.type).toBe("json_schema");
      return {
        status: "completed",
        model: "test-model-resolved",
        output_text: JSON.stringify(encodeTransport(bundle.schema, original)),
        usage: {
          input_tokens: 100,
          input_tokens_details: { cached_tokens: 20 },
          output_tokens: 60,
          output_tokens_details: { reasoning_tokens: 10 },
          total_tokens: 160,
        },
      };
    },
  );
  const options: ExecutionOptions = {
    model: "test-fast",
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
  const result = await executor.execute(bundle, {}, options);
  expect(calls).toBe(1);
  expect(result.output).toEqual(original);
  expect(result.model).toBe("test-model-resolved");
  expect(result.usage.cachedInputTokens).toBe(20);
  expect(result.usage.actualCostUsd).toBeNull();
});
it("missing API token details are null, while reported zero is retained", () => {
  expect(responseUsage({})).toEqual(unknownUsage());
  expect(
    responseUsage({
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        input_tokens_details: { cached_tokens: 0 },
      },
    }).cachedInputTokens,
  ).toBe(0);
});
it("refusal/incomplete output retains measured usage and never becomes a publishable artifact", async () => {
  const ai = testAI();
  ai.enabled = true;
  const bundle = new SkillRegistry().load("benchmark-researcher");
  const executor = new OpenAIResponsesSkillExecutor(
    ai,
    "unit-key",
    async () => ({
      status: "incomplete",
      usage: { input_tokens: 90, output_tokens: 20, total_tokens: 110 },
    }),
  );
  try {
    await executor.execute(
      bundle,
      {},
      {
        model: "test-fast",
        workflowClass: "FAST",
        maxOutputTokens: 4096,
        timeoutMs: 1000,
        prepared: {
          skillCore: "",
          relevantReferences: {},
          taskContext: {},
          structuredInputs: {},
        },
        signal: new AbortController().signal,
      },
    );
    throw new Error("Expected incomplete response to fail");
  } catch (e) {
    expect(e).toBeInstanceOf(ExecutionFailure);
    expect((e as ExecutionFailure).usage.inputTokens).toBe(90);
  }
});
