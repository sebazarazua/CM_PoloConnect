import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

export function resolvePython(env = process.env) {
  const candidates = [];
  if (env.PYTHON_EXECUTABLE) candidates.push([env.PYTHON_EXECUTABLE, []]);
  const venv = resolve(
    process.platform === "win32"
      ? ".venv/Scripts/python.exe"
      : ".venv/bin/python",
  );
  if (existsSync(venv)) candidates.push([venv, []]);
  for (const name of ["python", "py", "python3"])
    candidates.push([name, name === "py" ? ["-3"] : []]);
  const installed = join(homedir(), "AppData/Local/Programs/Python");
  if (existsSync(installed))
    for (const folder of readdirSync(installed).sort().reverse()) {
      const exe = join(installed, folder, "python.exe");
      if (existsSync(exe)) candidates.push([exe, []]);
    }
  const bundled = join(
    homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  );
  if (existsSync(bundled)) candidates.push([bundled, []]);
  for (const [exe, args] of candidates) {
    const probe = spawnSync(
      exe,
      [
        ...args,
        "-c",
        "import sys;sys.exit(0 if sys.version_info >= (3,10) else 1)",
      ],
      { encoding: "utf8", timeout: 5000, windowsHide: true },
    );
    if (!probe.error && probe.status === 0)
      return { exe, args, venv: exe === venv };
    if (env.PYTHON_EXECUTABLE === exe)
      throw new Error(
        "Configured PYTHON_EXECUTABLE is unavailable or older than 3.10",
      );
  }
  throw new Error(
    "Python >=3.10 unavailable; configure PYTHON_EXECUTABLE or install official CPython.",
  );
}
