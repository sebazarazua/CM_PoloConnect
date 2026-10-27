import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensure } from "../common/core.js";
import type { SkillExecutor } from "../skills/runtime.js";
import { FixtureSkillExecutor } from "../skills/fixture-executor.js";
import { loadAISettings } from "./config.js";
import { GeminiSkillExecutor } from "./gemini-executor.js";
import { OpenAIResponsesSkillExecutor } from "./openai-executor.js";
import type { AISettings } from "./types.js";
export function selectedAISettings(
  env: NodeJS.ProcessEnv = process.env,
): AISettings {
  const provider = env.AI_PROVIDER || "gemini";
  ensure(
    ["gemini", "openai", "fixture"].includes(provider),
    "AI_PROVIDER must be gemini, openai or fixture",
  );
  if (provider !== "gemini") return loadAISettings(env);
  const settings = loadAISettings(env);
  const profile = JSON.parse(
    readFileSync(resolve("config/ai.gemini.json"), "utf8"),
  ) as Pick<AISettings, "classes" | "perSkill" | "version">;
  for (const limits of Object.values(profile.classes)) {
    for (const key of [
      "maxCalls",
      "maxInputTokens",
      "maxOutputTokens",
    ] as const)
      ensure(
        Number.isInteger(limits[key]) && limits[key] > 0,
        `Invalid Gemini budget ${key}`,
      );
    ensure(
      limits.maxCostUsd !== null &&
        Number.isFinite(limits.maxCostUsd) &&
        limits.maxCostUsd > 0,
      "Invalid Gemini cost budget",
    );
  }
  for (const limits of Object.values(profile.perSkill))
    for (const key of ["maxInputTokens", "maxOutputTokens"] as const)
      if (limits[key] !== undefined)
        ensure(
          Number.isInteger(limits[key]) && limits[key]! > 0,
          `Invalid Gemini Skill limit ${key}`,
        );
  const path = resolve(env.GEMINI_PRICING_FILE || "config/pricing.gemini.json");
  ensure(existsSync(path), "Gemini price configuration is missing");
  const pricing = JSON.parse(
    readFileSync(path, "utf8"),
  ) as AISettings["pricing"] & { validUntil?: string };
  ensure(
    pricing.validUntil && Date.parse(pricing.validUntil) > Date.now(),
    "Gemini price table expired; verify current official prices before paid calls",
  );
  for (const p of Object.values(pricing.models))
    ensure(
      [p.input, p.cachedInput, p.output].every(
        (v) => Number.isFinite(v) && v >= 0,
      ),
      "Invalid Gemini prices",
    );
  return {
    ...settings,
    ...profile,
    pricing,
    models: {
      FAST: env.GEMINI_MODEL_FAST?.trim() || "gemini-3.8-flash",
      STANDARD: env.GEMINI_MODEL_STANDARD?.trim() || "gemini-3.8-flash",
      PREMIUM: env.GEMINI_MODEL_PREMIUM?.trim() || "gemini-3.8-flash",
    },
  };
}
export function selectedExecutor(
  settings: AISettings,
  env: NodeJS.ProcessEnv = process.env,
): SkillExecutor {
  const provider = env.AI_PROVIDER || "gemini";
  if (provider === "fixture") return new FixtureSkillExecutor();
  if (provider === "openai")
    return new OpenAIResponsesSkillExecutor(settings, env.OPENAI_API_KEY);
  return new GeminiSkillExecutor(
    settings,
    env.GEMINI_API_KEY?.trim() || env.GOOGLE_API_KEY?.trim(),
  );
}
