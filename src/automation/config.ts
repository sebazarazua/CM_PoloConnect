import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensure, hash } from "../common/core.js";
import type { AutomationMode } from "./types.js";
export interface AutomationConfig {
  mode: AutomationMode;
  dryRun: boolean;
  enableAutoPublish: boolean;
  enableRealPublishing: boolean;
  accountId: string;
  source: "manual_queue" | "fixture";
  allowFictitious: boolean;
  timezone: string;
  windows: Array<{ days: number[]; start: string; end: string }>;
  bypassWindowEventTypes: string[];
  allowedEventTypes: string[];
  maxPosts24Hours: number;
  minGapMinutes: number;
  maxPerCycle: number;
  maxCandidates: number;
  maxLlmCallsPerCycle: number;
  maxCostUsdPerCycle: number;
  leaseMinutes: number;
}
export function loadAutomationConfig(
  env: NodeJS.ProcessEnv = process.env,
  path = resolve("config/automation.json"),
): AutomationConfig {
  const file = JSON.parse(readFileSync(path, "utf8")) as Omit<
    AutomationConfig,
    | "mode"
    | "dryRun"
    | "enableAutoPublish"
    | "enableRealPublishing"
    | "accountId"
    | "source"
    | "allowFictitious"
  >;
  const boolean = (key: string, fallback: boolean) => {
    ensure(
      !env[key] || ["true", "false"].includes(env[key]),
      `${key} must be true or false`,
    );
    return env[key] ? env[key] === "true" : fallback;
  };
  const mode = env.AUTOMATION_MODE || "supervised",
    source = env.AUTOMATION_CONTENT_SOURCE || "manual_queue";
  ensure(
    ["manual", "supervised", "automatic"].includes(mode),
    "Invalid AUTOMATION_MODE",
  );
  ensure(
    ["manual_queue", "fixture"].includes(source),
    "Invalid AUTOMATION_CONTENT_SOURCE",
  );
  new Intl.DateTimeFormat("en", { timeZone: file.timezone });
  for (const w of file.windows)
    ensure(
      w.days.length > 0 &&
        w.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(w.start) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(w.end) &&
        w.start !== w.end,
      "Invalid editorial window",
    );
  for (const key of [
    "maxPosts24Hours",
    "maxPerCycle",
    "maxCandidates",
    "maxLlmCallsPerCycle",
    "leaseMinutes",
  ] as const)
    ensure(
      Number.isInteger(file[key]) && file[key] > 0 && file[key] <= 100,
      `Invalid automation limit ${key}`,
    );
  ensure(
    file.minGapMinutes >= 0 &&
      file.maxCostUsdPerCycle > 0 &&
      Number.isFinite(file.maxCostUsdPerCycle),
    "Invalid automation budget/gap",
  );
  return {
    ...file,
    mode: mode as AutomationMode,
    dryRun: boolean("AUTOMATION_DRY_RUN", true),
    enableAutoPublish: boolean("ENABLE_AUTO_PUBLISH", false),
    enableRealPublishing: boolean("ENABLE_REAL_PUBLISHING", false),
    accountId:
      env.AUTOMATION_INSTAGRAM_ACCOUNT_ID?.trim() ||
      env.INSTAGRAM_USER_ID?.trim() ||
      "",
    source: source as AutomationConfig["source"],
    allowFictitious: boolean("AUTOMATION_ALLOW_FICTITIOUS", false),
  };
}
/** Dry-run is intentionally excluded so B and C evaluate the same editorial policy. */
export const policyConfigHash = (c: AutomationConfig) => {
  const policy: Partial<AutomationConfig> = { ...c };
  delete policy.dryRun;
  return hash(policy);
};
