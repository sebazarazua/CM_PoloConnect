import { it, expect } from "vitest";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { CommunityManagerOrchestrator } from "../src/orchestration/community-manager.js";
import { MemoryRepository } from "../src/persistence/repository.js";
import { mockProviders } from "../src/providers/mock/index.js";
import { LocalDesignRenderer } from "../src/render/provider.js";
import { runAIDemo } from "../src/workflows/demo.js";
import { FixtureSkillExecutor } from "../src/skills/fixture-executor.js";
import type { SkillExecutor } from "../src/skills/runtime.js";
import { SkillRegistry } from "../src/skills/runtime.js";
import type { PreparedContext, ExecutionOptions } from "../src/ai/types.js";
import { OpenAIResponsesSkillExecutor } from "../src/ai/openai-executor.js";
import { encodeTransport } from "../src/ai/structured-output.js";
import { current } from "../src/domain/models.js";
import { testAI } from "./ai-helpers.js";
import { fileDigest, digest } from "../src/render/brand.js";
import { DeterministicQualityGate } from "../src/qa/deterministic-gate.js";

it("social-designer → RenderSpec → PNG → Quality Reviewer gets actual final pixel attachments and version hash", async () => {
  const dir = resolve(".local", "review-pixels-" + process.pid);
  mkdirSync(dir, { recursive: true });
  const design = new LocalDesignRenderer(dir, ["feed", "story", "reel_cover"]),
    repository = new MemoryRepository(),
    fixture = new FixtureSkillExecutor();
  let prepared: PreparedContext | undefined;
  let skillCalls = 0;
  const spy: SkillExecutor = {
    name: "fixture-pixel-spy",
    version: "1",
    model: null,
    usesLLM: false,
    execute: async (bundle, input, options) => {
      skillCalls++;
      if (bundle.name === "quality-reviewer") prepared = options?.prepared;
      return fixture.execute(bundle, input);
    },
  };
  const cm = new CommunityManagerOrchestrator(
    repository,
    { ...mockProviders(), design },
    spy,
  );
  try {
    const c = await runAIDemo(cm);
    expect(c.publications).toHaveLength(0);
    expect(prepared?.visualAssets).toHaveLength(3);
    const image = prepared!.visualAssets![0]!;
    expect(skillCalls).toBe(4);
    await runAIDemo(cm);
    expect(skillCalls).toBe(4);
    expect(image.sha256).toBe(fileDigest(image.path));
    expect(image.width).toBe(1080);
    expect(image.height).toBe(1350);
    const stored = (await repository.read()).runs.find(
      (r) => r.skill === "quality-reviewer",
    );
    expect(JSON.stringify(stored?.input)).not.toContain("base64,");
    const ai = testAI();
    ai.enabled = true;
    let requests = 0;
    const executor = new OpenAIResponsesSkillExecutor(
      ai,
      "unit-key",
      async (body) => {
        requests++;
        expect(Array.isArray(body.input)).toBe(true);
        const input = body.input as {
          content: { type: string; image_url?: string; detail?: string }[];
        }[];
        const attachment = input[0]!.content.find(
          (p) => p.type === "input_image",
        )!;
        expect(attachment.detail).toBe("high");
        expect(attachment.image_url).toMatch(/^data:image\/png;base64,/);
        expect(
          digest(Buffer.from(attachment.image_url!.split(",")[1]!, "base64")),
        ).toBe(image.sha256);
        const review = JSON.parse(
          readFileSync("fixtures/skill-outputs/quality-reviewer.json", "utf8"),
        ) as unknown;
        return {
          status: "completed",
          output_text: JSON.stringify(
            encodeTransport(
              new SkillRegistry().load("quality-reviewer").schema,
              review,
            ),
          ),
        };
      },
    );
    const options: ExecutionOptions = {
      model: "test-standard",
      workflowClass: "STANDARD",
      maxOutputTokens: 4096,
      timeoutMs: 1000,
      prepared: prepared!,
      signal: new AbortController().signal,
    };
    await executor.execute(
      new SkillRegistry().load("quality-reviewer"),
      {},
      options,
    );
    expect(requests).toBe(1);
    const fake = structuredClone(options.prepared);
    fake.visualAssets![0]!.sha256 = "a".repeat(64);
    await expect(
      executor.execute(
        new SkillRegistry().load("quality-reviewer"),
        {},
        { ...options, prepared: fake },
      ),
    ).rejects.toThrow("changed");
    expect(requests).toBe(1);
    const state = await repository.read();
    const asset = current(c.assets)!.data.find((a) => a.stage === "rendered")!;
    asset.metadata.sha256 = "b".repeat(64);
    const gate = new DeterministicQualityGate(cm.runner.validator).inspect(
      state,
      c,
      Object.values(state.events)[0]!.data,
    );
    expect(gate.issues.some((i) => i.code === "render_integrity")).toBe(true);
    writeFileSync(image.path, "tampered test bytes");
    const blocked = await cm.runQualityReview(c.id);
    expect(blocked.status).toBe("blocked");
    expect(blocked.blockers[0]?.code).toBe("render_integrity");
    expect(blocked.approvals.at(-1)?.invalidatedAt).toBeTruthy();
  } finally {
    await design.close();
    if (!relative(resolve(".local"), dir).startsWith(".."))
      rmSync(dir, { recursive: true, force: true });
  }
});
