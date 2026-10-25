import { beforeAll, afterAll, it, expect } from "vitest";
import { readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import sharp from "sharp";
import {
  extractPalette,
  loadBrand,
  fileDigest,
  contrast,
} from "../src/render/brand.js";
import {
  assertSpec,
  assertCarousel,
  specFromPlan,
  truthFromEvent,
  decisionFromPlan,
  type MediaRef,
} from "../src/render/spec.js";
import { LocalRenderer, type RenderReceipt } from "../src/render/renderer.js";
import { gallerySpec } from "../src/render/demo.js";
import { families, surfaces } from "../src/render/catalog.js";
import { demoEvent } from "../src/providers/mock/index.js";
import type { SkillOutputs } from "../src/domain/models.js";
import { artHTML } from "../src/render/html.js";

const dir = resolve(".local", "render-test-" + process.pid),
  renderer = new LocalRenderer();
const plan = JSON.parse(
  readFileSync("fixtures/skill-outputs/social-designer.json", "utf8"),
) as SkillOutputs["social-designer"];
const truth = truthFromEvent(demoEvent().candidate),
  base = specFromPlan(plan, truth, "feed");
let first: RenderReceipt, media: MediaRef;
beforeAll(async () => {
  mkdirSync(dir, { recursive: true });
  first = await renderer.render(base, truth, dir, "baseline");
  const path = resolve(dir, "owned-test-pixels.png");
  await sharp({
    create: { width: 1600, height: 1200, channels: 3, background: "#476348" },
  })
    .png()
    .toFile(path);
  media = {
    id: "test-owned-image",
    path,
    sha256: fileDigest(path),
    rights: "owned",
    source: "test fixture: solid pixels, not documentary sports",
    synthetic: false,
    credit: "Test fixture",
    focal: { x: 0.5, y: 0.5 },
  };
});
afterAll(async () => {
  await renderer.close();
  if (!relative(resolve(".local"), dir).startsWith(".."))
    rmSync(dir, { recursive: true, force: true });
});
it("official logos retain original bytes, dimensions and aspect ratios", () => {
  const brand = loadBrand();
  expect(brand.assets).toHaveLength(2);
  expect(brand.assets.find((a) => a.id === "horizontal")).toMatchObject({
    width: 628,
    height: 231,
    rights: "owned",
    source: "provided_by_owner",
  });
  expect(brand.assets.find((a) => a.id === "icon")).toMatchObject({
    width: 200,
    height: 200,
  });
  for (const a of brand.assets) expect(fileDigest(a.path)).toBe(a.sha256);
  expect(first.qa.logoRatio).toBeCloseTo(628 / 231, 2);
});
it("palette extraction is repeatable and semantic anchors come from the actual assets", async () => {
  const paths = loadBrand().assets.map((a) => a.path),
    a = await extractPalette(paths),
    b = await extractPalette(paths);
  expect(a).toEqual(b);
  for (const token of [
    "brand.navy",
    "brand.darkBlue",
    "brand.blue",
    "brand.brightBlue",
  ])
    expect(a.map((c) => c.hex)).toContain(loadBrand().colors[token]);
});
it("brand has semantic colors, licensed local fonts and legible text pairs", () => {
  const brand = loadBrand();
  expect(brand.colors["brand.navy"]).toBe("#070d25");
  expect(brand.typography.status).toBe("provisional_editorial_recommendation");
  expect(contrast(brand.colors["brand.navy"]!, "#ffffff")).toBeGreaterThan(15);
  expect(readFileSync("brand/assets/fonts/barlow-OFL.txt", "utf8")).toContain(
    "SIL OPEN FONT LICENSE",
  );
});
it("RenderSpec rejects arbitrary HTML/layout effects and unknown variants", () => {
  expect(() =>
    assertSpec({ ...base, html: "<div>custom</div>" }, truth),
  ).toThrow("RenderSpec");
  expect(() =>
    assertSpec({ ...base, decision: { ...base.decision, glow: true } }, truth),
  ).toThrow("RenderSpec");
  expect(() =>
    assertSpec(
      { ...base, decision: { ...base.decision, family: "epic-ai-sports" } },
      truth,
    ),
  ).toThrow("RenderSpec");
});
it("renderer produces real PNG/JPG at requested dimensions with measured QA", async () => {
  const png = await sharp(first.png).metadata(),
    jpg = await sharp(first.jpg).metadata();
  expect(png).toMatchObject({ width: 1080, height: 1350, format: "png" });
  expect(jpg).toMatchObject({ width: 1080, height: 1350, format: "jpeg" });
  expect(first.qa.passed).toBe(true);
  expect(first.qa.minContrast).toBeGreaterThanOrEqual(4.5);
  expect(first.qa.visualReview).toBe("required");
});
it("same inputs are idempotent and hit render cache; changed spec invalidates it", async () => {
  const again = await renderer.render(base, truth, dir, "baseline");
  expect(again.cached).toBe(true);
  expect(again.pngSha256).toBe(first.pngSha256);
  const next = structuredClone(base);
  next.decision.brandIntensity = "strong";
  const changed = await renderer.render(next, truth, dir, "baseline");
  expect(changed.cached).toBe(false);
  expect(changed.key).not.toBe(first.key);
  expect(changed.pngSha256).not.toBe(first.pngSha256);
});
it("tampered output bytes cannot satisfy the render cache", async () => {
  const r = await renderer.render(base, truth, dir, "tamper");
  await sharp({
    create: { width: 1080, height: 1350, channels: 3, background: "red" },
  })
    .png()
    .toFile(r.png);
  const restored = await renderer.render(base, truth, dir, "tamper");
  expect(restored.cached).toBe(false);
  expect(restored.pngSha256).toBe(first.pngSha256);
});
it("score, verified version and tournament mismatches block before render", () => {
  const bad = structuredClone(base);
  bad.content.score!.homeScore = 13;
  expect(() => assertSpec(bad, truth)).toThrow("Score");
  expect(() =>
    assertSpec(
      { ...base, provenance: { ...base.provenance, eventVersion: 2 } },
      truth,
    ),
  ).toThrow("version");
  expect(() =>
    assertSpec(
      { ...base, content: { ...base.content, tournament: "Other" } },
      truth,
    ),
  ).toThrow("Tournament");
});
it("unauthorized, expired and synthetic assets are blocked regardless of aesthetics", () => {
  const withPhoto = { ...base, photo: { ...media, rights: "rights_unknown" } };
  expect(() => assertSpec(withPhoto, truth)).toThrow("RenderSpec");
  expect(() =>
    assertSpec({ ...base, photo: { ...media, synthetic: true } }, truth),
  ).toThrow("synthetic");
  expect(() =>
    assertSpec(
      { ...base, photo: { ...media, expiresAt: "2020-01-01T00:00:00Z" } },
      truth,
    ),
  ).toThrow("expired");
  expect(() =>
    assertSpec(
      { ...base, photo: { ...media, allowedSurfaces: ["story"] } },
      truth,
    ),
  ).toThrow("surface rights");
});
it("missing photo blocks factual photo composition; placeholder is explicit and demo-only", () => {
  const spec = structuredClone(base);
  spec.decision.family = "result-photo-dominant";
  spec.decision.visualCarrier = "photo";
  spec.provenance.simulated = false;
  spec.provenance.demoPlaceholder = false;
  expect(() => assertSpec(spec, { ...truth, simulated: false })).toThrow(
    "Missing authentic",
  );
  expect(
    artHTML({
      ...base,
      decision: { ...base.decision, family: "result-photo-dominant" },
    }),
  ).toContain("DEMO · SIN FOTOGRAFÍA");
  expect(() =>
    assertSpec(
      { ...base, provenance: { ...base.provenance, simulated: false } },
      { ...truth, simulated: false },
    ),
  ).toThrow("Placeholder");
});
it("missing or unknown official logo is a blocker", () =>
  expect(() => assertSpec({ ...base, logo: "invented-logo" }, truth)).toThrow(
    "RenderSpec",
  ));
it("missing local photograph and changed image bytes are blocked", () => {
  expect(() =>
    assertSpec(
      { ...base, photo: { ...media, path: resolve(dir, "not-present.png") } },
      truth,
    ),
  ).toThrow("missing");
  expect(() =>
    assertSpec({ ...base, photo: { ...media, sha256: "f".repeat(64) } }, truth),
  ).toThrow("changed");
});
it("fallback composition varies with recent families; explicit validated art direction takes priority", () => {
  expect(
    decisionFromPlan(plan, "feed", [], ["result-score-dominant"]).family,
  ).toBe("result-minimal");
  const explicit = structuredClone(plan);
  explicit.render_decision = {
    ...base.decision,
    family: "result-minimal",
    brandIntensity: "subtle",
    theme: "light",
  };
  expect(decisionFromPlan(explicit, "feed", [])).toMatchObject({
    family: "result-minimal",
    theme: "light",
    brandIntensity: "subtle",
  });
});
it("Story and Reel cover recompose within conservative safe areas", async () => {
  for (const surface of ["story", "reel_cover"] as const) {
    const spec = specFromPlan(plan, truth, surface);
    const result = await renderer.render(spec, truth, dir, surface);
    expect(await sharp(result.png).metadata()).toMatchObject({
      width: 1080,
      height: 1920,
    });
    expect(result.qa.safeArea.top).toBe(surface === "story" ? 220 : 320);
    expect(result.qa.passed).toBe(true);
    expect(result.pngSha256).not.toBe(first.pngSha256);
  }
});
it("long text overflow blocks export instead of clipping or inventing a shorter fact", async () => {
  const sample = gallerySpec(base, truth, "news-announcement", 0);
  sample.spec.content.headline = "MUY LARGO ".repeat(90);
  sample.truth.approvedDisplay.push(sample.spec.content.headline);
  await expect(
    renderer.render(sample.spec, sample.truth, dir, "overflow"),
  ).rejects.toThrow(/overflow|bounds|collision/);
  expect(existsSync(resolve(dir, "overflow.png"))).toBe(false);
});
it("protected photographic subject cannot be cropped out", async () => {
  const spec = structuredClone(base);
  spec.decision.family = "result-photo-dominant";
  spec.decision.visualCarrier = "photo";
  spec.photo = { ...media, subject: { x: 0, y: 0, width: 1, height: 1 } };
  await expect(renderer.render(spec, truth, dir, "crop")).rejects.toThrow(
    /protected/,
  );
});
it("sponsor requirements cannot be invented, omitted or replaced", () => {
  expect(() =>
    assertSpec(base, { ...truth, sponsorId: "mandatory-sponsor" }),
  ).toThrow("sponsor");
  expect(() =>
    assertSpec(
      {
        ...base,
        sponsor: { name: "Test sponsor", required: true, asset: media },
      },
      truth,
    ),
  ).toThrow("Sponsor");
});
it("carousel continuity binds dimensions, theme, source and slide rhythm", () => {
  const a = gallerySpec(base, truth, "carousel-cover", 0).spec,
    b = gallerySpec(base, truth, "carousel-context", 0).spec;
  a.carousel = { id: "c", index: 1, total: 2, continuity: "pc-v1" };
  b.carousel = { id: "c", index: 2, total: 2, continuity: "pc-v1" };
  expect(() => assertCarousel([a, b])).not.toThrow();
  b.decision.theme = "light";
  expect(() => assertCarousel([a, b])).toThrow("continuity");
});
it("family catalog covers all requested editorial groups and responsive sizes", () => {
  expect(Object.keys(families)).toHaveLength(32);
  expect(new Set(Object.values(families).map((f) => f.group)).size).toBe(8);
  expect(surfaces.square).toEqual([1080, 1080]);
});
it("render HTML escapes approved text and exposes no active external resources", () => {
  const spec = structuredClone(base);
  spec.content.tournament = "<script>alert(1)</script>";
  const html = artHTML(spec);
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain("default-src 'none'");
  expect(html).not.toMatch(/src="https?:/);
});
