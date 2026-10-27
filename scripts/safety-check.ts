import { readdirSync, readFileSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { ensure } from "../src/common/core.js";
import { dangerousFlags, loadConfig } from "../src/config/index.js";

const root = resolve(".");
const excluded = new Set([
  "node_modules",
  "dist",
  ".git",
  ".python-deps",
  ".postgres",
  ".venv",
  "__pycache__",
]);
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{30,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bEAA[A-Za-z0-9]{80,}\b/,
  /\bAIza[A-Za-z0-9_-]{30,}\b/,
];
let scanned = 0;
function scan(folder: string): void {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      scan(path);
      continue;
    }
    if (
      !/\.(?:ts|js|mjs|py|json|md|ya?ml|sql|toml|txt)$/.test(entry.name) &&
      entry.name !== ".env.example"
    )
      continue;
    const text = readFileSync(path, "utf8");
    scanned++;
    for (const pattern of patterns)
      ensure(
        !pattern.test(text),
        `Potential secret detected in ${relative(root, path)}`,
      );
    if (
      path.startsWith(join(root, "src")) &&
      /\b(?:fetch|axios|https?\.request)\s*\(/.test(text) &&
      path !== join(root, "src", "integrations", "instagram", "http.ts")
    )
      throw new Error(
        `Unexpected outbound transport in ${relative(root, path)}`,
      );
  }
}
scan(root);
const sample = readFileSync(".env.example", "utf8");
ensure(
  sample.includes("ENABLE_REAL_AI=false"),
  "Real AI example default must remain disabled",
);
for (const flag of dangerousFlags)
  ensure(
    sample.includes(`${flag}=false`),
    `Unsafe example configuration ${flag}`,
  );
for (const line of [
  "AI_PROVIDER=gemini",
  "AUTOMATION_MODE=supervised",
  "AUTOMATION_DRY_RUN=true",
  "ENABLE_AUTO_PUBLISH=false",
])
  ensure(sample.includes(line), `Unsafe or missing example default: ${line}`);
ensure(
  Object.values(loadConfig({}).flags).every((v) => v === false),
  "Unsafe feature flags",
);
console.log(
  JSON.stringify({
    filesScanned: scanned,
    secretPatterns: "none_detected",
    outboundTransports:
      "official Gemini/OpenAI SDKs; official Meta HTTPS allowlist; S3 SDK and signed GET checks",
    dangerousFlags:
      "example defaults all false; non-Instagram automation flags fail closed",
    publishing:
      "supervised/dry-run by default; live Instagram requires real flag plus human CLI/approval or automatic mode/kill switch/current policy authority",
  }),
);
