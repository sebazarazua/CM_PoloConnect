import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, delimiter } from "node:path";
import { resolvePython } from "./python-resolver.mjs";
const selected = resolvePython();
if (process.argv[2] === "--resolve-json") {
  console.log(JSON.stringify(selected));
  process.exit(0);
}
const local = resolve(".python-deps");
const env = { ...process.env };
if (!selected.venv && existsSync(local))
  env.PYTHONPATH = [local, env.PYTHONPATH].filter(Boolean).join(delimiter);
const result = spawnSync(
  selected.exe,
  [...selected.args, "-X", "utf8", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env,
    windowsHide: true,
  },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
