import {
  GeminiSkillExecutor,
  type GeminiTransport,
} from "../src/ai/gemini-executor.js";
import { selectedAISettings } from "../src/ai/factory.js";
import { encodeTransport } from "../src/ai/structured-output.js";
import { FixtureSkillExecutor } from "../src/skills/fixture-executor.js";
import type {
  SkillBundle,
  SkillInput,
  SkillExecutor,
} from "../src/skills/runtime.js";
import type { ExecutionOptions } from "../src/ai/types.js";
import { instagramConfig } from "../src/integrations/instagram/config.js";
import { InstagramPublishingProvider } from "../src/integrations/instagram/provider.js";
import {
  MetaHTTP,
  type HttpTransport,
} from "../src/integrations/instagram/http.js";
import { loadAutomationConfig } from "../src/automation/config.js";

/** Explicit test-only network double. The returned QA is synthetic contract evidence, not live AI validation. */
export class FakeGeminiExecutor implements SkillExecutor {
  readonly name = "gemini-genai";
  readonly version = "1";
  readonly provider = "gemini";
  readonly model = null;
  readonly live = true;
  readonly usesLLM = true;
  calls: string[] = [];
  requests: Parameters<GeminiTransport>[0][] = [];
  private fixture = new FixtureSkillExecutor();
  async execute(
    bundle: SkillBundle,
    input: SkillInput,
    options?: ExecutionOptions,
  ) {
    const output = await this.fixture.execute(bundle, input);
    if (bundle.name === "quality-reviewer") {
      const qa = output as {
        simulated: boolean;
        scope: { publishing_route: string };
      };
      qa.simulated = false;
      qa.scope.publishing_route = "instagram_api_with_instagram_login";
    }
    return new GeminiSkillExecutor(
      geminiSettings(),
      "test-only-not-a-real-key",
      async (request) => {
        this.calls.push(bundle.name);
        this.requests.push(request);
        return {
          text: JSON.stringify(encodeTransport(bundle.schema, output)),
          modelVersion: "gemini-3.8-flash",
          candidates: [{ finishReason: "STOP" as never }],
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 50,
            thoughtsTokenCount: 10,
            totalTokenCount: 160,
            cachedContentTokenCount: 0,
          },
        };
      },
    ).execute(bundle, input, options);
  }
}
export const geminiSettings = () =>
  selectedAISettings({ AI_PROVIDER: "gemini", ENABLE_REAL_AI: "true" });
export const autoConfig = () => ({
  ...loadAutomationConfig({ AUTOMATION_INSTAGRAM_ACCOUNT_ID: "123" }),
  allowFictitious: true,
});
export function fakeInstagram() {
  const calls: string[] = [];
  const transport: HttpTransport = async (url) => {
    const path = new URL(url).pathname;
    calls.push(path);
    const result = path.endsWith("/me")
      ? { user_id: "123", username: "test-only", account_type: "BUSINESS" }
      : path.endsWith("/permissions")
        ? {
            data: [
              "instagram_business_basic",
              "instagram_business_content_publish",
            ].map((permission) => ({ permission, status: "granted" })),
          }
        : path.endsWith("/media_publish")
          ? { id: "900" }
          : path.endsWith("/media")
            ? { id: "800" }
            : path.endsWith("/800")
              ? { id: "800", status_code: "FINISHED" }
              : path.endsWith("/900")
                ? {
                    id: "900",
                    permalink: "https://www.instagram.com/p/test-only/",
                  }
                : null;
    if (!result) throw new Error(`Unexpected fake Meta request ${path}`);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return {
    calls,
    provider: new InstagramPublishingProvider(
      instagramConfig({
        INSTAGRAM_API_VERSION: "v99.0",
        ENABLE_REAL_PUBLISHING: "true",
      }),
      {
        accountId: "123",
        username: "test-only",
        accountType: "BUSINESS",
        accessToken: "test-only-token",
        obtainedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        permissions: [
          "instagram_business_basic",
          "instagram_business_content_publish",
        ],
      },
      new MetaHTTP(transport),
      { attempts: 1, intervalMs: 0 },
    ),
  };
}
