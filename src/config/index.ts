import { CMError } from "../common/core.js";
export const dangerousFlags = [
  "ENABLE_REAL_PUBLISHING",
  "ENABLE_AUTO_APPROVAL",
  "ENABLE_AUTO_RENDER",
  "ENABLE_EXTERNAL_FETCHING",
] as const;
export interface Config {
  mode: "mock";
  maxRetries: number;
  maxReroutes: number;
  flags: Record<(typeof dangerousFlags)[number], false>;
}
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  for (const flag of dangerousFlags) {
    if (env[flag] !== undefined && env[flag] !== "" && env[flag] !== "false")
      throw new CMError(
        "permanent_error",
        `${flag} no está implementado en esta fase; debe permanecer false`,
      );
  }
  const limit = (key: string, fallback: number) => {
    const n = Number(env[key] ?? fallback);
    if (!Number.isInteger(n) || n < 0 || n > 10)
      throw new CMError("permanent_error", `Invalid ${key}`);
    return n;
  };
  return {
    mode: "mock",
    maxRetries: limit("MAX_SKILL_RETRIES", 2),
    maxReroutes: limit("MAX_REROUTES", 4),
    flags: Object.fromEntries(
      dangerousFlags.map((k) => [k, false]),
    ) as Config["flags"],
  };
}
export const editorial = {
  timezone: "America/Buenos_Aires",
  language: "es-AR",
  platform: "instagram",
  requireHumanApproval: true,
  version: "0.1.0",
} as const;
