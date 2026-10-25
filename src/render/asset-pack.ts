import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { fileDigest, type BrandAsset } from "./brand.js";

/** Reversible source registration plus deterministic white-matte extraction.
 * No generative reconstruction: every alpha sample retains the source position.
 */
export async function buildAssetPack(
  source = "brand/assets/icons/polo-connect-app-icon.webp",
) {
  const { data, info } = await sharp(source)
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = Buffer.alloc(info.width * info.height),
    blue = Buffer.alloc(alpha.length);
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const pixel = y * info.width + x,
        i = pixel * 4,
        r = data[i]!,
        g = data[i + 1]!,
        b = data[i + 2]!;
      // The app's rounded-square backing is outside the symbol's circular extent.
      if (Math.hypot(x - 100, y - 100) > 85 || data[i + 3]! < 128) continue;
      const min = Math.min(r, g, b),
        max = Math.max(r, g, b);
      if (min > 242 && max - min < 10) continue;
      const radius = Math.hypot(x - 100, y - 100);
      const isBlue =
        radius > 60 && b > 100 && b - r > 12 && (g - r) / (b - r) > 0.4;
      const coverage = Math.min(1, (255 - min) / (isBlue ? 222 : 248));
      // Reject the app-backing reflection below the outer blue contour.
      if(y>150&&radius>78&&!isBlue&&coverage<.65)continue;
      alpha[pixel] =
        radius > 65 && !isBlue && min > 160 && max - min < 15
          ? 0
          : coverage < 0.15
            ? 0
            : Math.round(Math.min(1, (coverage - 0.04) / 0.96) * 255);
      blue[pixel] = isBlue ? 255 : 0;
    }
  // Remove isolated compression specks, preserving connected symbol contours.
  const visited = new Uint8Array(alpha.length);
  for (let seed = 0; seed < alpha.length; seed++) {
    if (!alpha[seed] || visited[seed]) continue;
    const component: number[] = [],
      queue = [seed];
    visited[seed] = 1;
    for (let q = 0; q < queue.length; q++) {
      const p = queue[q]!;
      component.push(p);
      const x = p % info.width,
        y = Math.floor(p / info.width);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || xx >= info.width || yy < 0 || yy >= info.height)
            continue;
          const next = yy * info.width + xx;
          if (alpha[next] && !visited[next]) {
            visited[next] = 1;
            queue.push(next);
          }
        }
    }
    if (component.length < 3) for (const p of component) alpha[p] = 0;
  }
  const variants = {
    "full-color": { rider: [7, 13, 37], ring: [36, 124, 230] },
    "on-light": { rider: [7, 13, 37], ring: [28, 111, 210] },
    "on-dark": { rider: [255, 255, 255], ring: [102, 205, 255] },
    "mono-white": { rider: [255, 255, 255], ring: [255, 255, 255] },
    "mono-navy": { rider: [7, 13, 37], ring: [7, 13, 37] },
    "high-contrast-dark": { rider: [255, 255, 255], ring: [145, 224, 255] },
    "high-contrast-light": { rider: [0, 0, 0], ring: [0, 71, 144] },
  };
  const dir = resolve("brand/assets/production");
  mkdirSync(dir, { recursive: true });
  const exports: {
    variant: string;
    size: number;
    path: string;
    sha256: string;
  }[] = [];
  const assets: BrandAsset[] = [];
  for (const [variant, colors] of Object.entries(variants)) {
    const rgba = Buffer.alloc(info.width * info.height * 4);
    for (let p = 0; p < alpha.length; p++) {
      const color = blue[p] ? colors.ring : colors.rider;
      for (let c = 0; c < 3; c++) rgba[p * 4 + c] = color[c]!;
      rgba[p * 4 + 3] = alpha[p]!;
    }
    for (const size of [64, 128, 256, 512, 1024]) {
      const path = `brand/assets/production/polo-connect-icon-${variant}-${size}.png`;
      const resized = await sharp(rgba, {
        raw: { width: info.width, height: info.height, channels: 4 },
      })
        .resize(size, size, { kernel: "lanczos3" })
        .raw()
        .toBuffer();
      // Keep monochrome pigment exact after alpha-aware interpolation.
      if (variant.startsWith("mono-"))
        for (let p = 0; p < resized.length; p += 4)
          for (let c = 0; c < 3; c++) resized[p + c] = colors.rider[c]!;
      await sharp(resized, { raw: { width: size, height: size, channels: 4 } })
        .png()
        .toFile(path);
      exports.push({ variant, size, path, sha256: fileDigest(path) });
      if (size === 256)
        assets.push({
          id: variant,
          path,
          sha256: fileDigest(path),
          width: size,
          height: size,
          source: "deterministic normalization of owner app icon",
          rights: "owned",
          role: "production_brand_mark",
        });
    }
  }
  await sharp(alpha, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .png()
    .toFile(resolve(dir, "source-alpha-mask.png"));
  const manifest = {
    version: "2",
    source,
    sourceSha256: fileDigest(source),
    originalUnchanged: true,
    method:
      "source-aligned white-matte alpha extraction, backing removed, source geometry retained, deterministic color remapping",
    nativeSource: { width: info.width, height: info.height },
    exports,
    productionAssets: assets,
    notes:
      "1024 exports are resampled from the 200px original; no invented high-resolution detail or claimed vector master.",
  };
  writeFileSync(
    resolve(dir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return { assets, manifest };
}
