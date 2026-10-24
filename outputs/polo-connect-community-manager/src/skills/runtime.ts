import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { CMError, hash, id, now, redact } from "../common/core.js";
import type { Config } from "../config/index.js";
import type {
  Asset,
  ContentItem,
  PerformanceSnapshot,
  SkillName,
  SkillOutputs,
  Store,
} from "../domain/models.js";

export interface SkillInput {
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
  readonly name: string;
  readonly version: string;
  readonly model: string | null;
  execute(bundle: SkillBundle, input: SkillInput): Promise<unknown>;
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
  private bundles = new Map<SkillName, SkillBundle>();
  constructor(readonly root = resolve("skills")) {}
  load(name: SkillName): SkillBundle {
    const cached = this.bundles.get(name);
    if (cached) return cached;
    const folder = join(this.root, name);
    const instructions = readFileSync(join(folder, "SKILL.md"), "utf8");
    const references = Object.fromEntries(
      readdirSync(join(folder, "references"))
        .filter((f) => f.endsWith(".md"))
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
      fingerprint: hash({ instructions, references, schema, scripts }),
    };
    this.bundles.set(name, bundle);
    return bundle;
  }
}
export class OutputValidator {
  private ajv = new Ajv2020.default({ allErrors: true, strict: false });
  constructor(
    private registry: SkillRegistry,
    private projectRoot = resolve("."),
  ) {
    addFormats.default(this.ajv);
  }
  validate<K extends SkillName>(skill: K, record: unknown): SkillOutputs[K] {
    const schema = this.registry.load(skill).schema;
    const validate = this.ajv.compile(schema);
    if (!validate(record))
      throw new CMError(
        "validation_error",
        `${skill}: ${this.ajv.errorsText(validate.errors)}`,
      );
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
    const result = spawnSync(
      python,
      ["-X", "utf8", join(this.projectRoot, "scripts/validate_output.py")],
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
export class SkillRunner {
  readonly validator: OutputValidator;
  constructor(
    private registry: SkillRegistry,
    private executor: SkillExecutor,
    private config: Config,
  ) {
    this.validator = new OutputValidator(registry);
  }
  async run<K extends SkillName>(
    store: Store,
    skill: K,
    input: SkillInput,
    contentId: string | null = null,
    force = false,
  ): Promise<SkillOutputs[K]> {
    const bundle = this.registry.load(skill);
    const inputHash = hash({
      skill,
      input,
      contentId,
      knowledge: bundle.fingerprint,
      executor: this.executor.name,
      version: this.executor.version,
      model: this.executor.model,
      config: this.config,
    });
    const previous = store.runs.findLast(
      (r) => r.inputHash === inputHash && r.status === "success",
    );
    if (previous && !force) {
      store.audit.push({
        id: id("audit"),
        contentId,
        kind: "skill_cache_hit",
        at: now(),
        detail: { skill, runId: previous.id, inputHash },
      });
      return structuredClone(previous.output) as SkillOutputs[K];
    }
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      const startedAt = now(),
        started = Date.now();
      try {
        const raw = await this.executor.execute(bundle, structuredClone(input));
        const output = this.validator.validate(skill, raw);
        store.runs.push({
          id: id("run"),
          skill,
          contentId,
          inputHash,
          knowledgeHash: bundle.fingerprint,
          input: redact(input),
          output: redact(output),
          startedAt,
          endedAt: now(),
          durationMs: Date.now() - started,
          status: "success",
          attempt,
          executor: this.executor.name,
          model: this.executor.model,
          configuration: redact(this.config),
          error: null,
        });
        return output;
      } catch (cause) {
        const error =
          cause instanceof CMError
            ? cause
            : new CMError(
                "provider_error",
                cause instanceof Error ? cause.message : String(cause),
              );
        store.runs.push({
          id: id("run"),
          skill,
          contentId,
          inputHash,
          knowledgeHash: bundle.fingerprint,
          input: redact(input),
          output: null,
          startedAt,
          endedAt: now(),
          durationMs: Date.now() - started,
          status: "error",
          attempt,
          executor: this.executor.name,
          model: this.executor.model,
          configuration: redact(this.config),
          error: { kind: error.kind, message: String(redact(error.message)) },
        });
        store.audit.push({
          id: id("audit"),
          contentId,
          kind: "workflow_error",
          at: now(),
          detail: {
            skill,
            kind: error.kind,
            message: redact(error.message),
            attempt,
          },
        });
        if (
          error.kind !== "retryable_error" ||
          attempt === this.config.maxRetries
        )
          throw error;
      }
    }
    throw new CMError("permanent_error", "Retry budget exhausted");
  }
}
