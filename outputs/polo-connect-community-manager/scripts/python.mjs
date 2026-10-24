import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve, delimiter } from "node:path";
import { homedir } from "node:os";
const bundled = join(
  homedir(),
  ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
);
const python =
  process.env.PYTHON_EXECUTABLE ||
  (existsSync(bundled)
    ? bundled
    : process.platform === "win32"
      ? "python"
      : "python3");
const local = resolve(".python-deps");
const env = { ...process.env };
if (existsSync(local))
  env.PYTHONPATH = [local, env.PYTHONPATH].filter(Boolean).join(delimiter);
const result = spawnSync(python, ["-X", "utf8", ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
  windowsHide: true,
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
