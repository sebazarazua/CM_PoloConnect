import { FixtureSkillExecutor } from "../src/skills/fixture-executor.js";
import type {
  SkillExecutor,
  SkillInput,
  SkillBundle,
} from "../src/skills/runtime.js";
import { loadAISettings } from "../src/ai/config.js";
import {
  unknownUsage,
  type AISettings,
  type ExecutionOptions,
  type ExecutionReceipt,
} from "../src/ai/types.js";
import { CommunityManagerOrchestrator } from "../src/orchestration/community-manager.js";
import { MemoryRepository } from "../src/persistence/repository.js";
import { mockProviders } from "../src/providers/mock/index.js";
import { loadConfig } from "../src/config/index.js";

export function testAI(): AISettings {
  const a = loadAISettings({
    MODEL_FAST: "test-fast",
    MODEL_STANDARD: "test-standard",
    MODEL_PREMIUM: "test-premium",
  });
  a.pricing = {
    version: "unit-test-prices",
    models: Object.fromEntries(
      ["test-fast", "test-standard", "test-premium", "test-other"].map((m) => [
        m,
        { input: 1, cachedInput: 0.5, output: 2 },
      ]),
    ),
  };
  return a;
}
export class CountingExecutor implements SkillExecutor {
  readonly name = "counting";
  readonly version = "1";
  readonly provider = "fake";
  readonly model = null;
  readonly usesLLM = true;
  calls: Array<{
    skill: string;
    references: string[];
    model: string | null;
    prepared: unknown;
  }> = [];
  private fixture = new FixtureSkillExecutor();
  async execute(
    bundle: SkillBundle,
    input: SkillInput,
    options?: ExecutionOptions,
  ): Promise<ExecutionReceipt> {
    this.calls.push({
      skill: bundle.name,
      references: Object.keys(bundle.references),
      model: options?.model ?? null,
      prepared: options?.prepared,
    });
    return {
      kind: "skill_execution",
      output: await this.fixture.execute(bundle, input),
      provider: "fake",
      model: options?.model ?? null,
      usage: {
        ...unknownUsage(),
        inputTokens: 100,
        cachedInputTokens: 40,
        outputTokens: 50,
        reasoningTokens: 10,
        totalTokens: 150,
      },
    };
  }
}
export function countingCM(
  settings = testAI(),
  executor: SkillExecutor = new CountingExecutor(),
) {
  return {
    cm: new CommunityManagerOrchestrator(
      new MemoryRepository(),
      mockProviders(),
      executor,
      loadConfig({}),
      settings,
    ),
    executor,
  };
}
