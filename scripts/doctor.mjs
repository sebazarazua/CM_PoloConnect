import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolvePython } from "./python-resolver.mjs";
const version = (exe, args) => {
  const r = spawnSync(exe, args, {
    encoding: "utf8",
    timeout: 12000,
    windowsHide: true,
  });
  return r.status === 0 ? r.stdout.trim() : null;
};
const python = resolvePython();
if (existsSync(".env")) process.loadEnvFile(".env");
console.log(
  JSON.stringify(
    {
      project: resolve("."),
      gitRoot: version("git", ["rev-parse", "--show-toplevel"]),
      package: existsSync("package.json"),
      lockfile: existsSync("package-lock.json"),
      node: process.version,
      npm: process.env.npm_config_user_agent ?? null,
      python: {
        executable: python.exe,
        version: version(python.exe, [...python.args, "--version"]),
        pip: version(python.exe, [...python.args, "-m", "pip", "--version"]),
      },
      git: version("git", ["--version"]),
      winget: version(
        join(homedir(), "AppData/Local/Microsoft/WindowsApps/winget.exe"),
        ["--version"],
      ),
      dockerClient: version("docker", ["--version"]),
      aiProvider: process.env.AI_PROVIDER || "gemini",
      realApiKeyConfigured:
        (process.env.AI_PROVIDER || "gemini") === "openai"
          ? !!process.env.OPENAI_API_KEY
          : !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    },
    null,
    2,
  ),
);
