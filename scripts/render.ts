import { parseArgs } from "node:util";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderDemo } from "../src/render/demo.js";
import { LocalRenderer } from "../src/render/renderer.js";
import { specFile, type TruthRecord } from "../src/render/spec.js";
import { redact } from "../src/common/core.js";
import {
  renderResultInput,
  type ResultInput,
} from "../src/render/result-input.js";
if (existsSync(".env")) process.loadEnvFile(".env");
const { values } = parseArgs({
  options: {
    mode: { type: "string" },
    gallery: { type: "boolean" },
    "real-ai": { type: "boolean" },
    input: { type: "string" },
    spec: { type: "string" },
    truth: { type: "string" },
    out: { type: "string" },
  },
});
try {
  if (values.mode && !["study", "production"].includes(values.mode))
    throw new Error("Mode must be study or production");
  if (values.input) {
    if (values["real-ai"])
      throw new Error(
        "--input uses operator-approved facts/art direction and deterministic fixture planning; use cm:render-demo -- --real-ai for the governed AI experiment",
      );
    console.log(
      JSON.stringify(
        await renderResultInput(
          {
            ...JSON.parse(readFileSync(values.input, "utf8")),
            ...(values.mode ? { mode: values.mode } : {}),
          } as ResultInput,
          resolve(values.out ?? "outputs/result"),
        ),
        null,
        2,
      ),
    );
  } else if (values.spec) {
    if (!values.truth)
      throw new Error(
        "--truth is required; the render spec cannot verify its own facts",
      );
    const renderer = new LocalRenderer();
    try {
      console.log(
        JSON.stringify(
          await renderer.render(
            {
              ...specFile(values.spec),
              ...(values.mode
                ? { mode: values.mode as "study" | "production" }
                : {}),
            },
            JSON.parse(readFileSync(values.truth, "utf8")) as TruthRecord,
            resolve(values.out ?? "outputs/custom-render"),
          ),
          null,
          2,
        ),
      );
    } finally {
      await renderer.close();
    }
  } else
    console.log(
      JSON.stringify(
        await renderDemo({
          gallery: values.gallery,
          realAI: values["real-ai"],
          outDir: values.out,
          mode: values.mode as "study" | "production" | undefined,
        }),
        null,
        2,
      ),
    );
} catch (error) {
  console.error(
    JSON.stringify(
      redact({
        error: error instanceof Error ? error.message : "Render failed",
      }),
    ),
  );
  process.exitCode = 1;
}
