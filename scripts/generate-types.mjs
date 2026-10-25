import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { compile } from "json-schema-to-typescript";
const names = {
  "benchmark-researcher": "BenchmarkRecord",
  "polo-news-researcher": "NewsEvent",
  "content-opportunity-detector": "ContentOpportunity",
  "editorial-strategist": "EditorialPlan",
  "reel-planner": "ReelPlan",
  "social-designer": "SocialDesignPlan",
  copywriter: "SocialCopy",
  "quality-reviewer": "QualityReview",
  "performance-analyst": "PerformanceAnalysis",
};
mkdirSync("src/skills/generated", { recursive: true });
for (const [skill, name] of Object.entries(names)) {
  const file = readdirSync(`skills/${skill}/assets`).find((f) =>
    f.endsWith(".schema.json"),
  );
  const schema = JSON.parse(
    readFileSync(`skills/${skill}/assets/${file}`, "utf8"),
  );
  schema.title = name;
  writeFileSync(
    `src/skills/generated/${skill}.ts`,
    await compile(schema, name, {
      bannerComment:
        "/* Generated from the original skill JSON Schema. npm run skills:types */",
      unknownAny: true,
    }),
  );
}
