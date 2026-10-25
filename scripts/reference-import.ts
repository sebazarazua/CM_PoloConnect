import { parseArgs } from "node:util";
import {
  copyFileSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { resolve, extname } from "node:path";
import sharp from "sharp";
import { ensure } from "../src/common/core.js";
import { extractPalette, fileDigest } from "../src/render/brand.js";
const { values } = parseArgs({
  options: {
    file: { type: "string" },
    source: { type: "string" },
    mechanisms: { type: "string" },
  },
});
ensure(values.file, "--file screenshot/image path is required");
const file = resolve(values.file),
  extension = extname(file).toLowerCase();
ensure(
  [".png", ".jpg", ".jpeg", ".webp"].includes(extension),
  "Use a raster screenshot, not active HTML/SVG",
);
const metadata = await sharp(file).metadata();
ensure(metadata.width && metadata.height, "Invalid reference image");
const sha256 = fileDigest(file),
  path = resolve("brand/references/inbox", sha256.slice(0, 16) + extension);
mkdirSync(resolve("brand/references/inbox"), { recursive: true });
copyFileSync(file, path);
const allowed = [
  "hierarchy",
  "crop",
  "typography",
  "density",
  "score",
  "carousel_rhythm",
  "photo_treatment",
];
const tags = (values.mechanisms ?? "").split(",").filter(Boolean);
ensure(
  tags.every((t) => allowed.includes(t)),
  "Unknown mechanism tag",
);
const index = "brand/references/index.json",
  records = existsSync(index)
    ? (JSON.parse(readFileSync(index, "utf8")) as { sha256: string }[])
    : [];
const record = {
  sha256,
  path,
  source: values.source ?? "owner supplied reference",
  rights: "editorial_reference_only",
  width: metadata.width,
  height: metadata.height,
  aspect: metadata.width / metadata.height,
  technicalTags: [
    metadata.width > metadata.height
      ? "landscape"
      : metadata.width === metadata.height
        ? "square"
        : "portrait",
    metadata.width < 1000 ? "small_reference" : "large_reference",
  ],
  dominantColors: (await extractPalette([path])).slice(0, 8),
  mechanismTags: tags,
  mechanismTagSource: "operator",
  semanticVisualAnalysis: "pending_independent_review",
  policy:
    "Extract mechanisms only. No account-to-format mapping; do not trace or reproduce the design. Reference image is never a production photo.",
};
writeFileSync(
  index,
  JSON.stringify(
    [...records.filter((r) => r.sha256 !== sha256), record],
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(record, null, 2));
