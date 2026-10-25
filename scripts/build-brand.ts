import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { extractPalette, fileDigest } from "../src/render/brand.js";
import { renderSpecSchema } from "../src/render/spec.js";
const sources = [
  {
    id: "horizontal",
    path: "brand/assets/logos/polo-connect-logo-horizontal.png",
  },
  { id: "icon", path: "brand/assets/icons/polo-connect-app-icon.webp" },
];
const palette = await extractPalette(sources.map((s) => s.path));
const nearest = (target: number[]) =>
  [...palette].sort(
    (a, b) =>
      a.rgb.reduce((s, v, i) => s + (v - target[i]!) ** 2, 0) -
      b.rgb.reduce((s, v, i) => s + (v - target[i]!) ** 2, 0),
  )[0]!.hex;
const colors = {
  "brand.navy": nearest([6, 12, 36]),
  "brand.darkBlue": nearest([16, 34, 62]),
  "brand.blue": nearest([44, 83, 120]),
  "brand.brightBlue": nearest([34, 129, 226]),
  "brand.white": "#ffffff",
  "surface.dark": nearest([6, 12, 36]),
  "surface.light": "#f5f7f9",
  "surface.elevated": nearest([16, 34, 62]),
  "text.primaryDark": nearest([6, 12, 36]),
  "text.primaryLight": "#ffffff",
  "text.secondary": "#b7c9d9",
  "accent.primary": nearest([34, 129, 226]),
  "accent.secondary": nearest([35, 142, 183]),
  "status.live": "#cf3245",
  "status.result": nearest([34, 129, 226]),
  "status.breaking": "#cf3245",
};
const assets = await Promise.all(
  sources.map(async (source) => {
    const meta = await sharp(source.path).metadata();
    return {
      ...source,
      sha256: fileDigest(source.path),
      width: meta.width,
      height: meta.height,
      source: "provided_by_owner",
      rights: "owned",
      authorization: "owner supplied for brand system use",
      role: "official_brand_reference",
      altered: false,
    };
  }),
);
const typography = {
  display: "Barlow Condensed",
  body: "Barlow",
  status: "provisional_editorial_recommendation",
  rationale:
    "Condensed display for compact sports hierarchy and tabular scores; normal-width body for Spanish readability. Independent of the image wordmark.",
  license: "SIL OFL 1.1",
  files: [
    "Barlow-Regular.ttf",
    "Barlow-SemiBold.ttf",
    "BarlowCondensed-Bold.ttf",
    "BarlowCondensed-SemiBold.ttf",
  ].map((file) => ({
    path: "brand/assets/fonts/" + file,
    sha256: fileDigest("brand/assets/fonts/" + file),
  })),
};
const save = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
save("brand/tokens/colors.json", {
  version: "1",
  method:
    "opaque pixels, RGB bins of 16, nearest dense sampled cluster to owner anchors; neutrals/status explicitly designed",
  tokens: colors,
  gradients: { brandDepth: ["brand.navy", "brand.blue"] },
});
save("brand/generated/render-spec.schema.json", renderSpecSchema);
save("brand/generated/palette-analysis.json", {
  sources: assets,
  palette,
  policy:
    "Color extraction is evidence; semantic assignments are provisional art direction. No logo has been edited.",
});
save("brand/tokens/typography.json", typography);
save("brand/tokens/spacing.json", {
  unit: 8,
  edge: 64,
  scale: [8, 16, 24, 32, 48, 64, 80, 96],
  logoClearSpace: 24,
});
save("brand/tokens/layout.json", {
  version: "1",
  surfaces: {
    feed: { width: 1080, height: 1350 },
    square: { width: 1080, height: 1080 },
    story: { width: 1080, height: 1920, safeTop: 220, safeBottom: 300 },
    reel_cover: {
      width: 1080,
      height: 1920,
      safeTop: 320,
      safeBottom: 320,
      gridPreview: { x: 0, y: 285, width: 1080, height: 1350 },
    },
  },
  note: "Conservative local design guides, not a certification of current Instagram UI. Revalidate on actual publishing route.",
});
save("brand/system.json", {
  name: "Polo Connect",
  status: "initial_derived_system",
  version: "1",
  assets,
  logos: assets.map((a) => a.path),
  colors,
  color_tokens: colors,
  typography,
  typography_tokens: typography,
  spacing: { unit: 8, edge: 64 },
  visual_rules: [
    "Authentic sports media only",
    "No synthetic documentary reality",
    "No glow, fire, particles, neon or exaggerated shadows",
    "Logo is an untouched image, never re-typeset",
  ],
  sponsors: [],
  naming: {},
  tone_notes: [],
  missing: [
    "higher-resolution transparent/vector official logo",
    "official editorial typography approval",
    "sponsor obligations when applicable",
  ],
  demo_policy:
    "Owner brand references; proposed editorial system. Abstract placeholder demo is clearly labeled and never documentary.",
});
const files = sources
  .map((s) => s.path)
  .concat(typography.files.map((f) => f.path));
save("brand/assets/manifest.json", {
  assets,
  fonts: typography.files,
  source: "https://github.com/google/fonts/tree/main/ofl/barlow",
  sourceCondensed:
    "https://github.com/google/fonts/tree/main/ofl/barlowcondensed",
  files: files.map((path) => ({ path, sha256: fileDigest(path) })),
});
console.log(
  JSON.stringify({
    assets,
    colors,
    fonts: typography.files.length,
    originalsPreserved: true,
  }),
);
