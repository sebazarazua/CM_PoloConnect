import { it, expect } from "vitest";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, relative } from "node:path";
import sharp from "sharp";
import {
  loadBrand,
  fileDigest,
  digest,
  productionMark,
} from "../src/render/brand.js";
import { resolveFinish } from "../src/render/finish.js";
import {
  specFromPlan,
  truthFromEvent,
  assertSpec,
} from "../src/render/spec.js";
import { artHTML } from "../src/render/html.js";
import { LocalRenderer } from "../src/render/renderer.js";
import { demoEvent } from "../src/providers/mock/index.js";
import type { SkillOutputs } from "../src/domain/models.js";
const plan = JSON.parse(
  readFileSync("fixtures/skill-outputs/social-designer.json", "utf8"),
) as SkillOutputs["social-designer"];
const truth = truthFromEvent(demoEvent().candidate),
  base = specFromPlan(plan, truth, "feed");

it("production pack is derived from the unchanged owner app icon, with registered variants", () => {
  const manifest = JSON.parse(
    readFileSync("brand/assets/production/manifest.json", "utf8"),
  ) as { source: string; sourceSha256: string; exports: unknown[] };
  expect(fileDigest(manifest.source)).toBe(manifest.sourceSha256);
  expect(manifest.exports).toHaveLength(35);
  expect(loadBrand().productionAssets).toHaveLength(7);
});
it("production PNGs have transparent corners and identical geometry across color variants", async () => {
  const dark = await sharp(productionMark("dark").path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const light = await sharp(productionMark("light").path)
    .ensureAlpha()
    .raw()
    .toBuffer();
  const mask = (bytes: Buffer) =>
    Buffer.from(
      Array.from({ length: bytes.length / 4 }, (_, i) => bytes[i * 4 + 3]!),
    );
  expect(dark.data[3]).toBe(0);
  expect(dark.data[dark.data.length - 1]).toBe(0);
  expect(digest(mask(dark.data))).toBe(digest(mask(light)));
  expect(dark.info.width).toBe(dark.info.height);
  expect(mask(dark.data).filter((v) => v > 200).length).toBeGreaterThan(5000);
});
it("monochrome exports are single-color alpha masks, not opaque app screenshots", async () => {
  const bytes = await sharp(
    "brand/assets/production/polo-connect-icon-mono-white-256.png",
  )
    .ensureAlpha()
    .raw()
    .toBuffer();
  for (let i = 0; i < bytes.length; i += 4)
    if (bytes[i + 3]! > 200)
      expect([bytes[i], bytes[i + 1], bytes[i + 2]]).toEqual([255, 255, 255]);
});
it("production uses only the normalized icon and rejects horizontal reference marks", () => {
  const html = artHTML(base);
  expect(html).toContain('data-logo="on-dark"');
  expect(html).not.toContain(
    readFileSync(
      "brand/assets/logos/polo-connect-logo-horizontal.png",
    ).toString("base64"),
  );
  expect(() => assertSpec({ ...base, logo: "horizontal" }, truth)).toThrow(
    "reference",
  );
});
it("finish controls have separate study/production baselines and reject arbitrary effects", () => {
  expect(resolveFinish("production").depth_level).toBe(2);
  expect(resolveFinish("study").depth_level).toBe(0);
  expect(() =>
    assertSpec({ ...base, finish: { depth_level: 4 } }, truth),
  ).toThrow("RenderSpec");
  expect(() => assertSpec({ ...base, finish: { fire: true } }, truth)).toThrow(
    "RenderSpec",
  );
});
it("feed, Story and Play have distinct composition structures and preserve verified facts", () => {
  expect(artHTML(base)).toContain("feed-result-panel");
  expect(artHTML(specFromPlan(plan, truth, "story"))).toContain(
    "story-result-panel",
  );
  expect(artHTML(specFromPlan(plan, truth, "reel_cover"))).toContain(
    "cover-score-panel",
  );
  for (const surface of ["feed", "story", "reel_cover"] as const) {
    const html = artHTML(specFromPlan(plan, truth, surface));
    expect(html).toContain("Team Azul");
    expect(html).toContain("Team Blanco");
    expect(html).not.toContain("ESTUDIO / 01");
  }
});
it("study, polished and reduced-depth renders are distinct, cached and pass the same QA", async () => {
  const dir = resolve(".local", "finish-test-" + process.pid),
    renderer = new LocalRenderer();
  mkdirSync(dir, { recursive: true });
  try {
    const a = await renderer.render(base, truth, dir, "production"),
      b = await renderer.render(
        { ...base, mode: "study" },
        truth,
        dir,
        "study",
      ),
      c = await renderer.render(
        {
          ...base,
          finish: {
            depth_level: 0,
            graphic_density: 0,
            background_complexity: 0,
          },
        },
        truth,
        dir,
        "flat",
      );
    expect(a.qa.passed && b.qa.passed && c.qa.passed).toBe(true);
    expect(a.pngSha256).not.toBe(b.pngSha256);
    expect(a.pngSha256).not.toBe(c.pngSha256);
    expect((await renderer.render(base, truth, dir, "production")).cached).toBe(
      true,
    );
  } finally {
    await renderer.close();
    if (!relative(resolve(".local"), dir).startsWith(".."))
      rmSync(dir, { recursive: true, force: true });
  }
});
