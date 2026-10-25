import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CMError } from "../common/core.js";
import type { AISettings } from "./types.js";

export function loadAISettings(
  env: NodeJS.ProcessEnv = process.env,
  root = resolve("config"),
): AISettings {
  const config = JSON.parse(
    readFileSync(resolve(root, "ai.json"), "utf8"),
  ) as Omit<AISettings, "enabled" | "models" | "pricing">;
  const pricing = JSON.parse(
    readFileSync(resolve(root, "pricing.json"), "utf8"),
  ) as AISettings["pricing"];
  if (env.ENABLE_REAL_AI && !["true", "false"].includes(env.ENABLE_REAL_AI))
    throw new CMError(
      "permanent_error",
      "ENABLE_REAL_AI must be true or false",
    );
  for (const limits of Object.values(config.classes)) {
    for (const key of [
      "maxCalls",
      "maxInputTokens",
      "maxOutputTokens",
    ] as const)
      if (!Number.isInteger(limits[key]) || limits[key] < 1)
        throw new CMError("permanent_error", `Invalid AI budget ${key}`);
    if (
      limits.maxCostUsd !== null &&
      (!Number.isFinite(limits.maxCostUsd) || limits.maxCostUsd < 0)
    )
      throw new CMError("permanent_error", "Invalid cost budget");
  }
  for (const price of Object.values(pricing.models))
    if (Object.values(price).some((x) => !Number.isFinite(x) || x < 0))
      throw new CMError("permanent_error", "Invalid pricing configuration");
  return {
    ...config,
    pricing,
    enabled: env.ENABLE_REAL_AI === "true",
    models: {
      FAST: env.MODEL_FAST?.trim() || null,
      STANDARD: env.MODEL_STANDARD?.trim() || null,
      PREMIUM: env.MODEL_PREMIUM?.trim() || null,
    },
  };
}
