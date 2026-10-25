import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve, extname } from "node:path";
import sharp from "sharp";
import { ensure, hash } from "../common/core.js";
import { emptyStore, type Asset, type SkillOutputs } from "../domain/models.js";
import { SkillRunner, SkillRegistry } from "../skills/runtime.js";
import { FixtureSkillExecutor } from "../skills/fixture-executor.js";
import { loadConfig } from "../config/index.js";
import { fileDigest, loadBrand } from "./brand.js";
import { specFromPlan, type TruthRecord, type ArtDecision } from "./spec.js";
import { LocalRenderer } from "./renderer.js";
export interface ResultInput {
  eventId: string;
  eventVersion: number;
  verified: boolean;
  verifiedBy: string;
  source: string;
  simulated: boolean;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  tournament: string;
  stage: string;
  photo?: {
    path: string;
    rights: "owned" | "licensed" | "permission_confirmed";
    source: string;
    credit: string;
    focal?: { x: number; y: number };
    synthetic: boolean;
  };
  decision?: ArtDecision;
}
/** Explicit operator-verified input; never pretends to verify a score by rendering it. */
export async function renderResultInput(
  input: ResultInput,
  out = resolve("outputs/result"),
) {
  ensure(
    input.verified === true &&
      !!input.verifiedBy?.trim() &&
      !!input.source?.trim(),
    "Provide verified source and verifier; rendering is not news verification",
  );
  ensure(
    typeof input.simulated === "boolean" &&
      Number.isInteger(input.eventVersion) &&
      input.eventVersion >= 1,
    "Explicit simulated flag and event version required",
  );
  ensure(
    [input.homeScore, input.awayScore].every(
      (v) => Number.isInteger(v) && v >= 0 && v <= 99,
    ),
    "Invalid score",
  );
  ensure(
    [
      input.eventId,
      input.home,
      input.away,
      input.tournament,
      input.stage,
    ].every((v) => typeof v === "string" && v.trim().length > 0),
    "Missing verified result fields",
  );
  mkdirSync(out, { recursive: true });
  const sources: Asset[] = [];
  if (input.photo) {
    const p = input.photo;
    ensure(
      ["owned", "licensed", "permission_confirmed"].includes(p.rights) &&
        !!p.source?.trim() &&
        !!p.credit?.trim(),
      "Photo rights, source and credit are required",
    );
    ensure(p.synthetic === false, "Unsupported synthetic photograph");
    const ext = extname(p.path).toLowerCase();
    ensure(
      [".png", ".jpg", ".jpeg", ".webp"].includes(ext),
      "Use a local raster photo",
    );
    const sha = fileDigest(resolve(p.path)),
      path = resolve("assets/approved", sha + ext);
    mkdirSync(resolve("assets/approved"), { recursive: true });
    if (resolve(p.path) !== path) copyFileSync(resolve(p.path), path);
    const meta = await sharp(path).metadata();
    sources.push({
      id: "photo-" + sha.slice(0, 16),
      type: "photo",
      stage: "approved",
      storageRef: path,
      rights: p.rights,
      source: p.source,
      required: true,
      credit: p.credit,
      metadata: {
        actualMedia: true,
        synthetic: false,
        width: meta.width,
        height: meta.height,
        focal: p.focal ?? { x: 0.5, y: 0.5 },
        sha256: sha,
      },
    });
  }
  const claim = `${input.home} ${input.homeScore} — ${input.awayScore} ${input.away}`;
  const truth: TruthRecord = {
    eventId: input.eventId,
    version: input.eventVersion,
    verified: true,
    simulated: input.simulated,
    score: {
      home: input.home,
      away: input.away,
      homeScore: input.homeScore,
      awayScore: input.awayScore,
    },
    tournament: input.tournament,
    stage: input.stage,
    approvedDisplay: [claim, input.home, input.away],
  };
  const event = JSON.parse(
    readFileSync("fixtures/skill-outputs/polo-news-researcher.json", "utf8"),
  ) as SkillOutputs["polo-news-researcher"];
  event.event_id = input.eventId;
  event.headline_working = claim;
  event.event_type = "match_result";
  event.simulated = input.simulated;
  event.entities = [
    { type: "team", canonical_name: input.home },
    { type: "team", canonical_name: input.away },
    { type: "tournament", canonical_name: input.tournament },
  ];
  event.claims = [
    {
      claim,
      status: "confirmed_primary",
      confidence: "high",
      source_ids: ["operator-verified"],
    },
  ];
  event.sources = [
    {
      source_id: "operator-verified",
      url: input.source,
      role: "primary_official",
      publisher: input.verifiedBy,
      observed_at: event.observed_at,
      original_reporting: true,
    },
  ];
  const opportunity = JSON.parse(
    readFileSync(
      "fixtures/skill-outputs/content-opportunity-detector.json",
      "utf8",
    ),
  ) as SkillOutputs["content-opportunity-detector"];
  opportunity.opportunity_id = "provided-" + hash(truth).slice(0, 12);
  opportunity.handoff.required_facts = [claim];
  const state = emptyStore(),
    runner = new SkillRunner(
      new SkillRegistry(),
      new FixtureSkillExecutor(),
      loadConfig(),
    );
  const plan = await runner.run(state, "social-designer", {
    event,
    opportunity,
    assets: sources,
    format: "single_image",
    context: {
      brand: loadBrand(),
      verifiedBy: input.verifiedBy,
      source: input.source,
    },
  });
  if (input.decision) plan.render_decision = input.decision;
  const renderer = new LocalRenderer();
  try {
    const outputs = [];
    for (const [surface, name] of [
      ["feed", "feed-result"],
      ["story", "story-result"],
      ["reel_cover", "reel-cover"],
    ] as const) {
      const spec = specFromPlan(plan, truth, surface, sources);
      if (input.decision && surface !== "feed")
        spec.decision = {
          ...spec.decision,
          family:
            surface === "story"
              ? spec.photo
                ? "result-photo-dominant"
                : "story-result"
              : spec.photo
                ? "reel-cover-action"
                : "reel-cover-result",
        };
      outputs.push(await renderer.render(spec, truth, out, name));
      writeFileSync(
        resolve(out, name + ".spec.json"),
        JSON.stringify(spec, null, 2),
      );
    }
    writeFileSync(resolve(out, "truth.json"), JSON.stringify(truth, null, 2));
    writeFileSync(
      resolve(out, "design-plan.json"),
      JSON.stringify(plan, null, 2),
    );
    writeFileSync(
      resolve(out, "input-provenance.json"),
      JSON.stringify(
        {
          verifiedBy: input.verifiedBy,
          source: input.source,
          verifiedByOperator: true,
          independentNewsVerification: false,
          assets: sources,
          skillRuns: state.runs,
        },
        null,
        2,
      ),
    );
    return {
      outputs,
      planning:
        "FixtureSkillExecutor with optional supplied art direction; no LLM call",
      visualReview: "pending",
      approval: "required_pending",
      publishing: "disabled",
    };
  } finally {
    await renderer.close();
  }
}
