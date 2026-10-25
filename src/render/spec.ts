import Ajv2020 from "ajv/dist/2020.js";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { ensure, hash } from "../common/core.js";
import type { Asset, SkillOutputs } from "../domain/models.js";
import { families, surfaces, type Family, type Surface } from "./catalog.js";
import { loadBrand, fileDigest } from "./brand.js";
import type { Finish, RenderMode } from "./finish.js";

export interface Score {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
}
export interface TruthRecord {
  eventId: string;
  version: number;
  verified: boolean;
  simulated: boolean;
  score?: Score;
  tournament: string;
  stage: string;
  approvedDisplay: string[];
  sponsorId?: string;
  sponsor?: { id: string; sha256: string; name: string };
}
export interface MediaRef {
  id: string;
  path: string;
  sha256: string;
  rights: "owned" | "licensed" | "permission_confirmed";
  source: string;
  synthetic: boolean;
  credit: string | null;
  expiresAt?: string;
  allowedSurfaces?: Surface[];
  focal: { x: number; y: number };
  subject?: { x: number; y: number; width: number; height: number };
}
export interface ArtDecision {
  family: Family;
  visualCarrier: "photo" | "score" | "type" | "data" | "quote";
  hierarchy: string[];
  density: "low" | "standard";
  photoTreatment: "natural" | "contrast" | "none";
  brandIntensity: "subtle" | "standard" | "strong";
  theme: "dark" | "light";
}
export interface RenderSpec {
  mode?: RenderMode;
  finish?: Partial<Finish>;
  version: "1";
  id: string;
  surface: Surface;
  width: number;
  height: number;
  decision: ArtDecision;
  logo: "horizontal" | "icon";
  photo: MediaRef | null;
  content: {
    eyebrow: string;
    headline: string;
    subhead: string;
    tournament: string;
    stage: string;
    score: Score | null;
    quote: { text: string; attribution: string } | null;
    stats: { label: string; value: string; unit: string }[];
    schedule: { label: string; value: string }[];
  };
  sponsor: { name: string; asset: MediaRef; required: boolean } | null;
  interaction: "none" | "link" | "poll" | "question";
  carousel: {
    id: string;
    index: number;
    total: number;
    continuity: string;
  } | null;
  provenance: {
    eventId: string;
    eventVersion: number;
    planHash: string;
    simulated: boolean;
    demoPlaceholder: boolean;
  };
}
const string = { type: "string", maxLength: 4000 };
const closed = (
  properties: Record<string, unknown>,
  required = Object.keys(properties),
) => ({ type: "object", additionalProperties: false, required, properties });
const number = { type: "number", minimum: 0, maximum: 1 };
const scoreSchema = closed({
  home: string,
  away: string,
  homeScore: { type: "integer", minimum: 0, maximum: 99 },
  awayScore: { type: "integer", minimum: 0, maximum: 99 },
});
const mediaSchema = closed(
  {
    id: string,
    path: string,
    sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
    rights: { enum: ["owned", "licensed", "permission_confirmed"] },
    source: string,
    synthetic: { type: "boolean" },
    credit: { anyOf: [string, { type: "null" }] },
    focal: closed({
      x: { type: "number", minimum: 0, maximum: 1 },
      y: { type: "number", minimum: 0, maximum: 1 },
    }),
    subject: closed({ x: number, y: number, width: number, height: number }),
    expiresAt: string,
    allowedSurfaces: { type: "array", items: { enum: Object.keys(surfaces) } },
  },
  ["id", "path", "sha256", "rights", "source", "synthetic", "credit", "focal"],
);
export const renderSpecSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Polo Connect RenderSpec v1",
  ...closed({
    mode: { enum: ["study", "production"] },
    finish: closed(
      {
        depth_level: { type: "integer", minimum: 0, maximum: 3 },
        accent_intensity: { type: "integer", minimum: 0, maximum: 3 },
        graphic_density: { type: "integer", minimum: 0, maximum: 3 },
        brand_energy: { type: "integer", minimum: 0, maximum: 3 },
        background_complexity: { type: "integer", minimum: 0, maximum: 3 },
      },
      [],
    ),
    version: { const: "1" },
    id: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,120}$" },
    surface: { enum: Object.keys(surfaces) },
    width: { type: "integer", minimum: 320, maximum: 4096 },
    height: { type: "integer", minimum: 320, maximum: 4096 },
    decision: closed({
      family: { enum: Object.keys(families) },
      visualCarrier: { enum: ["photo", "score", "type", "data", "quote"] },
      hierarchy: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        uniqueItems: true,
        items: { enum: ["score", "headline", "photo", "context"] },
      },
      density: { enum: ["low", "standard"] },
      photoTreatment: { enum: ["natural", "contrast", "none"] },
      brandIntensity: { enum: ["subtle", "standard", "strong"] },
      theme: { enum: ["dark", "light"] },
    }),
    logo: { enum: ["horizontal", "icon"] },
    photo: { anyOf: [mediaSchema, { type: "null" }] },
    content: closed({
      eyebrow: string,
      headline: string,
      subhead: string,
      tournament: string,
      stage: string,
      score: { anyOf: [scoreSchema, { type: "null" }] },
      quote: {
        anyOf: [
          closed({ text: string, attribution: string }),
          { type: "null" },
        ],
      },
      stats: {
        type: "array",
        maxItems: 4,
        items: closed({ label: string, value: string, unit: string }),
      },
      schedule: {
        type: "array",
        maxItems: 6,
        items: closed({ label: string, value: string }),
      },
    }),
    sponsor: {
      anyOf: [
        closed({
          name: string,
          asset: mediaSchema,
          required: { type: "boolean" },
        }),
        { type: "null" },
      ],
    },
    interaction: { enum: ["none", "link", "poll", "question"] },
    carousel: {
      anyOf: [
        closed({
          id: string,
          index: { type: "integer", minimum: 1, maximum: 20 },
          total: { type: "integer", minimum: 1, maximum: 20 },
          continuity: string,
        }),
        { type: "null" },
      ],
    },
    provenance: closed({
      eventId: string,
      eventVersion: { type: "integer", minimum: 1 },
      planHash: string,
      simulated: { type: "boolean" },
      demoPlaceholder: { type: "boolean" },
    }),
  }),
};
renderSpecSchema.required = renderSpecSchema.required.filter(
  (key) => !["mode", "finish"].includes(key),
);
const ajv = new Ajv2020.default({ allErrors: true, strict: false });
const validate = ajv.compile(renderSpecSchema);
export function localPath(path: string): string {
  ensure(
    !/^(?:https?:|data:|mock:|file:)/i.test(path),
    "Renderer accepts workspace files only",
  );
  const full = realpathSync(resolve(path));
  const delta = relative(realpathSync(resolve(".")), full);
  ensure(
    delta !== ".." &&
      !delta.startsWith(".." + (process.platform === "win32" ? "\\" : "/")) &&
      !isAbsolute(delta),
    "Asset must stay inside workspace",
  );
  return full;
}
export function assertSpec(
  value: unknown,
  truth: TruthRecord,
): asserts value is RenderSpec {
  ensure(
    validate(value),
    "Invalid RenderSpec: " + ajv.errorsText(validate.errors),
  );
  const spec = value as unknown as RenderSpec;
  const d = spec.decision;
  const family = families[d.family];
  ensure(
    spec.logo === "icon",
    "Horizontal logo is a reference; production pieces require the app icon",
  );
  ensure(truth.verified, "blocked_verification");
  ensure(
    spec.provenance.eventId === truth.eventId &&
      spec.provenance.eventVersion === truth.version &&
      spec.provenance.simulated === truth.simulated,
    "Source-of-truth version mismatch",
  );
  ensure(
    spec.content.tournament === truth.tournament &&
      spec.content.stage === truth.stage,
    "Tournament/stage mismatch",
  );
  if (spec.content.score)
    ensure(
      hash(spec.content.score) === hash(truth.score),
      "Score consistency failed",
    );
  if (
    family.group === "result" ||
    d.family === "story-result" ||
    d.family === "reel-cover-result"
  )
    ensure(spec.content.score && truth.score, "Result needs verified score");
  if (family.layout === "quote")
    ensure(spec.content.quote, "Quote family requires exact attributed quote");
  if (family.layout === "stat" || family.layout === "comparison")
    ensure(
      spec.content.stats.length >= (family.layout === "comparison" ? 2 : 1),
      "Data family needs verified values",
    );
  if (family.layout === "schedule")
    ensure(spec.content.schedule.length, "Schedule requires fixtures");
  const approved = new Set([
    ...truth.approvedDisplay,
    truth.score?.home,
    truth.score?.away,
  ]);
  for (const text of [
    spec.content.headline,
    spec.content.subhead,
    spec.content.quote?.text,
    spec.content.quote?.attribution,
    ...spec.content.stats.flatMap((v) => [v.label, v.value, v.unit]),
    ...spec.content.schedule.flatMap((v) => [v.label, v.value]),
  ])
    if (text)
      ensure(
        approved.has(text),
        "Unapproved display text: " + text.slice(0, 80),
      );
  ensure(
    !family.photo ||
      spec.photo ||
      (truth.simulated && spec.provenance.demoPlaceholder),
    "Missing authentic photograph; replan or use labeled demo placeholder",
  );
  ensure(
    d.visualCarrier !== "photo" ||
      spec.photo ||
      (truth.simulated && spec.provenance.demoPlaceholder),
    "Photo carrier missing",
  );
  ensure(
    !spec.provenance.demoPlaceholder || truth.simulated,
    "Placeholder forbidden for factual output",
  );
  ensure(
    !truth.sponsorId || spec.sponsor?.asset.id === truth.sponsorId,
    "Required sponsor missing or incorrect",
  );
  ensure(
    !spec.sponsor || spec.sponsor.asset.id === truth.sponsorId,
    "Sponsor is not authorized in event brief",
  );
  if (spec.sponsor)
    ensure(
      truth.sponsor?.id === spec.sponsor.asset.id &&
        truth.sponsor.sha256 === spec.sponsor.asset.sha256 &&
        truth.sponsor.name === spec.sponsor.name,
      "Sponsor brief requires matching registered logo hash and name",
    );
  const brand = loadBrand();
  ensure(
    brand.assets.some((a) => a.id === spec.logo),
    "Official logo missing",
  );
  for (const asset of [spec.photo, spec.sponsor?.asset].filter(
    (a): a is MediaRef => !!a,
  )) {
    ensure(!asset.synthetic, "Unsupported synthetic sports/brand asset");
    ensure(
      ["owned", "licensed", "permission_confirmed"].includes(asset.rights),
      "blocked_rights",
    );
    ensure(
      !asset.expiresAt || Date.parse(asset.expiresAt) > Date.now(),
      "Asset permission expired",
    );
    ensure(
      !asset.allowedSurfaces || asset.allowedSurfaces.includes(spec.surface),
      "Asset surface rights mismatch",
    );
    ensure(existsSync(resolve(asset.path)), "Asset missing");
    ensure(
      fileDigest(localPath(asset.path)) === asset.sha256,
      "Asset changed since approval",
    );
  }
  if (spec.surface === "story")
    ensure(
      family.group === "story" ||
        ["result", "news", "fixture"].includes(family.group),
      "Family incompatible with Story",
    );
  if (family.group === "reel_cover")
    ensure(spec.surface === "reel_cover", "Reel cover must use cover surface");
  if (spec.carousel)
    ensure(
      spec.carousel.index <= spec.carousel.total,
      "Invalid carousel index",
    );
}
export function assertCarousel(specs: RenderSpec[]): void {
  ensure(specs.length >= 2, "Carousel needs a sequence");
  const first = specs[0]!;
  specs.forEach((s, i) =>
    ensure(
      s.surface === "carousel" &&
        s.carousel?.id === first.carousel?.id &&
        s.carousel?.continuity === first.carousel?.continuity &&
        s.carousel?.index === i + 1 &&
        s.carousel?.total === specs.length &&
        s.width === first.width &&
        s.height === first.height &&
        s.decision.theme === first.decision.theme &&
        s.logo === first.logo &&
        s.provenance.eventId === first.provenance.eventId,
      "Carousel continuity failed",
    ),
  );
  ensure(
    new Set(specs.map((s) => families[s.decision.family].layout)).size >= 2,
    "Carousel rhythm requires different information layouts",
  );
}
export function decisionFromPlan(
  plan: SkillOutputs["social-designer"],
  surface: Surface,
  sources: Asset[],
  recent: string[] = [],
): ArtDecision {
  const explicit = plan.render_decision as ArtDecision | undefined;
  if (explicit) return structuredClone(explicit);
  const photo = sources.some(
    (a) =>
      a.type === "photo" &&
      a.metadata.actualMedia === true &&
      Number(a.metadata.width) >= 1080,
  );
  const pool: Family[] =
    surface === "story"
      ? ["story-result"]
      : surface === "reel_cover"
        ? ["reel-cover-result"]
        : photo
          ? ["result-photo-dominant", "result-celebration"]
          : ["result-score-dominant", "result-minimal"];
  const family = pool.find((f) => !recent.slice(-2).includes(f)) ?? pool[0]!;
  return {
    family,
    visualCarrier: photo ? "photo" : "score",
    hierarchy: photo
      ? ["photo", "score", "context"]
      : ["score", "headline", "context"],
    density: "low",
    photoTreatment: photo ? "natural" : "none",
    brandIntensity: "standard",
    theme: family === "result-minimal" ? "light" : "dark",
  };
}
export function truthFromEvent(
  event: SkillOutputs["polo-news-researcher"],
  version = 1,
): TruthRecord {
  ensure(
    event.event_type === "match_result",
    "Automatic plan adapter currently requires a verified match result",
  );
  const teams = event.entities
    .filter((e) => e.type === "team")
    .map((e) => e.canonical_name);
  const scores = event.claims.flatMap((c) => [
    ...c.claim.matchAll(/\b(\d{1,2})\s*[-—–]\s*(\d{1,2})\b/g),
  ]);
  ensure(
    teams.length === 2 && scores.length >= 1,
    "Structured result requires two teams and an unambiguous verified score",
  );
  ensure(
    new Set(scores.map((m) => `${m[1]}-${m[2]}`)).size === 1,
    "Ambiguous verified score",
  );
  // Require ledger order explicitly; do not infer a winning side from a sorted entity list.
  const claim =
    event.claims.find(
      (c) => c.claim.includes(teams[0]!) && c.claim.includes(teams[1]!),
    )?.claim ?? "";
  ensure(
    claim.indexOf(teams[0]!) >= 0 &&
      claim.indexOf(teams[0]!) < claim.indexOf(teams[1]!),
    "Team order must be explicit in score claim",
  );
  const score = {
    home: teams[0]!,
    away: teams[1]!,
    homeScore: Number(scores[0]![1]),
    awayScore: Number(scores[0]![2]),
  };
  const tournament =
    event.entities.find((e) => e.type === "tournament")?.canonical_name ?? "";
  const explicit = event.render_facts as
    { score?: Score; stage?: string; tournament?: string } | undefined;
  if (event.simulated !== true)
    ensure(
      explicit?.stage &&
        explicit.tournament === tournament &&
        hash(explicit.score) === hash(score),
      "Real result needs explicit verified render_facts with score, tournament and stage; do not infer sporting semantics",
    );
  return {
    eventId: event.event_id,
    version,
    verified: event.claims.every(
      (c) =>
        ["confirmed_primary", "confirmed_multi_source"].includes(c.status) &&
        c.source_ids.length > 0 &&
        c.source_ids.every((id) =>
          event.sources.some((s) => s.source_id === id),
        ),
    ),
    simulated: event.simulated === true,
    score,
    tournament,
    stage: explicit?.stage ?? "FINAL",
    approvedDisplay: [
      event.headline_working,
      ...event.claims.map((c) => c.claim),
    ],
  };
}
export function specFromPlan(
  plan: SkillOutputs["social-designer"],
  truth: TruthRecord,
  surface: Surface,
  sources: Asset[] = [],
  recent: string[] = [],
): RenderSpec {
  ensure(
    plan.state === "ready_for_render",
    "Design plan is not ready for rendering",
  );
  const photo = sources.find(
    (a) => a.type === "photo" && a.metadata.actualMedia === true,
  );
  const dimensions = surfaces[surface];
  return {
    version: "1",
    mode: (plan.render_mode as RenderMode | undefined) ?? "production",
    finish: plan.render_finish as Partial<Finish> | undefined,
    id: `${surface}-${hash({ plan, truth, sources }).slice(0, 16)}`,
    surface,
    width: dimensions[0],
    height: dimensions[1],
    decision: decisionFromPlan(plan, surface, sources, recent),
    logo: "icon",
    photo: photo
      ? {
          id: photo.id,
          path: photo.storageRef,
          sha256: fileDigest(localPath(photo.storageRef)),
          rights: photo.rights as MediaRef["rights"],
          source: photo.source,
          credit: photo.credit,
          synthetic: photo.metadata.synthetic === true,
          focal: (photo.metadata.focal as MediaRef["focal"]) ?? {
            x: 0.5,
            y: 0.5,
          },
          expiresAt: photo.expiresAt,
        }
      : null,
    content: {
      eyebrow: "RESULTADO",
      headline: truth.score
        ? truth.score.home
        : plan.slides[0]!.primary_message,
      subhead: "",
      tournament: truth.tournament,
      stage: truth.stage,
      score: truth.score ?? null,
      quote: null,
      stats: [],
      schedule: [],
    },
    sponsor: null,
    interaction: "none",
    carousel: null,
    provenance: {
      eventId: truth.eventId,
      eventVersion: truth.version,
      planHash: hash(plan),
      simulated: truth.simulated,
      demoPlaceholder: !photo && truth.simulated,
    },
  };
}
export const specFile = (path: string) =>
  JSON.parse(readFileSync(path, "utf8")) as RenderSpec;
