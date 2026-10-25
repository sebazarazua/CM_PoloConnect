import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { CMError, hash, redact } from "../common/core.js";
import type {
  Asset,
  ContentItem,
  PerformanceSnapshot,
  SkillName,
  SkillOutputs,
} from "../domain/models.js";
import { selectReferences } from "../ai/context.js";
import {skillCore} from './core.js';
import type { ExecutionOptions } from "../ai/types.js";
export { SkillRunner } from "./runner.js";

export interface SkillInput {
  workflowId?: string;
  reason?: string;
  deterministicGate?: unknown;
  candidate?: SkillOutputs["polo-news-researcher"];
  event?: SkillOutputs["polo-news-researcher"];
  content?: ContentItem;
  opportunity?: SkillOutputs["content-opportunity-detector"];
  assets?: Asset[];
  format?: ContentItem["type"];
  stage?: "post_render" | "pre_publish";
  snapshot?: PerformanceSnapshot;
  context?: unknown;
}
export interface SkillBundle {
  name: SkillName;
  instructions: string;
  references: Record<string, string>;
  schema: object;
  fingerprint: string;
}
export interface SkillExecutor {
  readonly usesLLM?: boolean;
  readonly live?: boolean;
  readonly provider?: string;
  readonly name: string;
  readonly version: string;
  readonly model: string | null;
  execute(
    bundle: SkillBundle,
    input: SkillInput,
    options?: ExecutionOptions,
  ): Promise<unknown>;
}
/** Injection point for an authorized future model runner. No SDK, token or outbound transport is bundled. */
export class CallbackSkillExecutor implements SkillExecutor {
  constructor(
    readonly name: string,
    readonly version: string,
    readonly model: string | null,
    private callback: (
      bundle: SkillBundle,
      input: SkillInput,
    ) => Promise<unknown>,
  ) {}
  execute(bundle: SkillBundle, input: SkillInput): Promise<unknown> {
    return this.callback(bundle, input);
  }
}
export class SkillRegistry {
  constructor(readonly root = resolve("skills")) {}
  load(name: SkillName, names = selectReferences(name, {})): SkillBundle {
    const folder = join(this.root, name);
    const source = readFileSync(join(folder, "SKILL.md"), "utf8");
    const instructions=skillCore(source);
    const references = Object.fromEntries(
      names
        .filter((f) => /^[a-z0-9-]+\.md$/.test(f))
        .sort()
        .map((f) => [f, readFileSync(join(folder, "references", f), "utf8")]),
    );
    const schemaFile = readdirSync(join(folder, "assets")).find((f) =>
      f.endsWith(".schema.json"),
    )!;
    const schema = JSON.parse(
      readFileSync(join(folder, "assets", schemaFile), "utf8"),
    ) as object;
    const scripts = Object.fromEntries(
      readdirSync(join(folder, "scripts"))
        .filter((f) => f.endsWith(".py"))
        .map((f) => [f, readFileSync(join(folder, "scripts", f), "utf8")]),
    );
    const bundle = {
      name,
      instructions,
      references,
      schema,
      fingerprint: hash({ source, references, schema, scripts }),
    };
    return bundle;
  }
}
export class OutputValidator {
  private ajv = new Ajv2020.default({ allErrors: true, strict: false });
  private python: { exe: string; args: string[] };
  constructor(
    private registry: SkillRegistry,
    private projectRoot = resolve("."),
  ) {
    addFormats.default(this.ajv);
    const selected = spawnSync(
      process.execPath,
      [join(projectRoot, "scripts/python.mjs"), "--resolve-json"],
      { encoding: "utf8", timeout: 20000, windowsHide: true },
    );
    if (selected.error || selected.status !== 0)
      throw new CMError("permanent_error", "Python resolver unavailable");
    this.python = JSON.parse(selected.stdout) as {
      exe: string;
      args: string[];
    };
  }
  validate<K extends SkillName>(skill: K, record: unknown): SkillOutputs[K] {
    const schema = this.registry.load(skill).schema;
    const validate = this.ajv.compile(schema);
    if (!validate(record))
      throw new CMError(
        "validation_error",
        `${skill}: ${this.ajv.errorsText(validate.errors)}`,
      );
    const result = spawnSync(
      this.python.exe,
      [
        ...this.python.args,
        "-X",
        "utf8",
        join(this.projectRoot, "scripts/validate_output.py"),
      ],
      {
        input: JSON.stringify({ skill, record }),
        encoding: "utf8",
        timeout: 20000,
        windowsHide: true,
        maxBuffer: 2 * 1024 * 1024,
      },
    );
    if (result.error || result.status !== 0)
      throw new CMError(
        "permanent_error",
        `Behavioral validator unavailable for ${skill}: ${String(redact(result.error?.message || result.stderr))}`,
      );
    const errors = JSON.parse(result.stdout) as string[];
    if (errors.length)
      throw new CMError("validation_error", `${skill}: ${errors.join("; ")}`);
    return record as SkillOutputs[K];
  }
}
