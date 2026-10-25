import { readFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { ensure } from "../common/core.js";

export const digest = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");
export const fileDigest = (path: string) => digest(readFileSync(path));
export interface BrandAsset {
  id: string;
  path: string;
  sha256: string;
  width: number;
  height: number;
  source: string;
  rights: string;
  role: string;
}
export interface BrandSystem {
  version: string;
  status: string;
  assets: BrandAsset[];
  productionAssets: BrandAsset[];
  colors: Record<string, string>;
  typography: { display: string; body: string; status: string };
}
export function loadBrand(): BrandSystem {
  const system = JSON.parse(
    readFileSync(resolve("brand/system.json"), "utf8"),
  ) as BrandSystem;
  ensure(
    system.assets?.length === 2,
    "Official brand assets are not registered",
  );
  for (const asset of system.assets) {
    ensure(
      existsSync(resolve(asset.path)),
      `Official logo missing: ${asset.id}`,
    );
    ensure(
      fileDigest(resolve(asset.path)) === asset.sha256,
      `Official logo changed: ${asset.id}`,
    );
  }
  return system;
}
export function productionMark(theme: "dark" | "light"): BrandAsset {
  const brand = loadBrand();
  const mark = brand.productionAssets?.find(
    (a) => a.id === (theme === "dark" ? "on-dark" : "on-light"),
  );
  ensure(
    mark && existsSync(mark.path),
    "Production brand pack missing; run npm run brand:build",
  );
  ensure(
    fileDigest(mark.path) === mark.sha256,
    "Production brand mark changed",
  );
  return mark;
}
export function dataUri(path: string): string {
  const type = (
    {
      ".png": "image/png",
      ".webp": "image/webp",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".ttf": "font/ttf",
    } as Record<string, string>
  )[extname(path).toLowerCase()];
  ensure(type, "Unsupported local image/font format");
  return `data:${type};base64,${readFileSync(path).toString("base64")}`;
}
/** Deterministic color analysis of actual opaque pixels; never modifies source files. */
export async function extractPalette(paths: string[]) {
  const bins = new Map<string, { n: number; sum: number[] }>();
  for (const path of paths) {
    const { data } = await sharp(path)
      .toColourspace("srgb")
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 240) continue;
      const rgb = [data[i]!, data[i + 1]!, data[i + 2]!];
      const key = rgb.map((v) => Math.floor(v / 16)).join(",");
      const bin = bins.get(key) ?? { n: 0, sum: [0, 0, 0] };
      bin.n++;
      rgb.forEach((v, j) => {
        bin.sum[j]! += v;
      });
      bins.set(key, bin);
    }
  }
  return [...bins.values()]
    .filter((b) => b.n >= 20)
    .map((b) => {
      const rgb = b.sum.map((v) => Math.round(v / b.n));
      return {
        hex: "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join(""),
        rgb,
        pixels: b.n,
      };
    })
    .sort((a, b) => b.pixels - a.pixels || a.hex.localeCompare(b.hex));
}
export function contrast(a: string, b: string): number {
  const light = (hex: string) => {
    const values = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
  };
  const x = light(a),
    y = light(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
