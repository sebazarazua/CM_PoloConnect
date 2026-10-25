import { chromium, type Browser, type Page } from "playwright";
import sharp from "sharp";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { ensure, hash } from "../common/core.js";
import { artHTML } from "./html.js";
import {
  assertSpec,
  localPath,
  type RenderSpec,
  type TruthRecord,
} from "./spec.js";
import { fileDigest, loadBrand, productionMark } from "./brand.js";

export interface RenderQA {
  passed: boolean;
  issues: string[];
  textElements: number;
  minContrast: number;
  logoRatio: number;
  safeArea: { top: number; bottom: number };
  photoCrop: string;
  visualReview: "required";
}
export interface RenderReceipt {
  key: string;
  cached: boolean;
  png: string;
  jpg: string;
  html: string;
  manifest: string;
  pngSha256: string;
  jpgSha256: string;
  width: number;
  height: number;
  qa: RenderQA;
}
export class LocalRenderer {
  private browser?: Browser;
  async close() {
    await this.browser?.close();
    this.browser = undefined;
  }
  private async page(spec: RenderSpec): Promise<Page> {
    this.browser ??= await chromium.launch({ headless: true });
    const page = await this.browser.newPage({
      viewport: { width: spec.width, height: spec.height },
      deviceScaleFactor: 1,
      locale: "es-AR",
      timezoneId: "America/Argentina/Buenos_Aires",
      colorScheme: "dark",
      reducedMotion: "reduce",
    });
    await page.route("**/*", (route) => route.abort());
    return page;
  }
  async render(
    spec: RenderSpec,
    truth: TruthRecord,
    outDir = resolve("outputs/render-demo"),
    basename = spec.id,
  ): Promise<RenderReceipt> {
    assertSpec(spec, truth);
    ensure(/^[a-zA-Z0-9_-]{1,120}$/.test(basename), "Unsafe output basename");
    const delta = relative(resolve("."), resolve(outDir));
    ensure(
      delta !== ".." &&
        !delta.startsWith(".." + (process.platform === "win32" ? "\\" : "/")) &&
        !isAbsolute(delta),
      "Output must remain inside workspace",
    );
    mkdirSync(outDir, { recursive: true });
    localPath(outDir);
    const html = artHTML(spec),
      brand = loadBrand();
    this.browser ??= await chromium.launch({ headless: true });
    const key = hash({
      version: "html-renderer-1",
      html,
      spec,
      truth,
      brand,
      qaPolicy: readFileSync(resolve("src/render/browser-qa.js"), "utf8"),
      browser: this.browser.version(),
    });
    const png = resolve(outDir, basename + ".png"),
      jpg = resolve(outDir, basename + ".jpg"),
      htmlPath = resolve(outDir, basename + ".html"),
      manifest = resolve(outDir, basename + ".manifest.json");
    if (existsSync(manifest)) {
      try {
        const old = JSON.parse(readFileSync(manifest, "utf8")) as RenderReceipt;
        if (
          old.key === key &&
          old.qa.passed &&
          old.png === png &&
          old.jpg === jpg &&
          fileDigest(png) === old.pngSha256 &&
          fileDigest(jpg) === old.jpgSha256 &&
          readFileSync(htmlPath, "utf8") === html
        ) {
          const meta = await sharp(png).metadata();
          if (meta.width === spec.width && meta.height === spec.height)
            return { ...old, cached: true };
        }
      } catch {
        /* Any missing/changed output is rendered and checked again. */
      }
    }
    const page = await this.page(spec);
    try {
      await page.setContent(html, { waitUntil: "load" });
      await page.evaluate(async () => {
        await document.fonts.load("700 30px Display");
        await document.fonts.load("400 30px Barlow");
        await document.fonts.ready;
        await Promise.all([...document.images].map((image) => image.decode()));
      });
      const qa = await inspectPage(page, spec);
      ensure(
        qa.passed,
        "Render QA blocked: " + qa.issues.join("; "),
        "renderer_editor",
      );
      const bytes = await page.screenshot({
        type: "png",
        animations: "disabled",
        caret: "hide",
        scale: "css",
      });
      const meta = await sharp(bytes).metadata();
      ensure(
        meta.width === spec.width && meta.height === spec.height,
        "Output dimensions mismatch",
      );
      writeFileSync(png, bytes);
      await sharp(bytes)
        .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
        .toFile(jpg);
      writeFileSync(htmlPath, html);
      const receipt: RenderReceipt = {
        key,
        cached: false,
        png,
        jpg,
        html: htmlPath,
        manifest,
        pngSha256: fileDigest(png),
        jpgSha256: fileDigest(jpg),
        width: spec.width,
        height: spec.height,
        qa,
      };
      writeFileSync(
        manifest,
        JSON.stringify(
          {
            ...receipt,
            spec,
            truthHash: hash(truth),
            renderer: "Chromium HTML/CSS, no network",
            approval: "required_pending",
            publication: "disabled",
          },
          null,
          2,
        ) + "\n",
      );
      return receipt;
    } finally {
      await page.close();
    }
  }
}
export async function inspectPage(
  page: Page,
  spec: RenderSpec,
): Promise<RenderQA> {
  const logo = productionMark(spec.decision.theme);
  const vertical = ["story", "reel_cover"].includes(spec.surface);
  const safeTop =
    spec.surface === "reel_cover" ? 320 : spec.surface === "story" ? 220 : 40;
  const safeBottom =
    spec.surface === "reel_cover" ? 320 : spec.surface === "story" ? 300 : 40;
  const script = readFileSync(
    resolve("src/render/browser-qa.js"),
    "utf8",
  ).replace("export default", "");
  const metrics = (await page.evaluate(
    `(${script})(${JSON.stringify({ safeTop, safeBottom, width: spec.width, height: spec.height, logoWidth: logo.width, logoHeight: logo.height })})`,
  )) as {
    issues: string[];
    textElements: number;
    minContrast: number;
    logoRatio: number;
    photo: {
      width: number;
      height: number;
      boxWidth: number;
      boxHeight: number;
    } | null;
  };
  if (spec.photo && metrics.photo) {
    const p = metrics.photo;
    if (p.width < 640 || p.height < 480)
      metrics.issues.push(
        "Photo resolution below editorial minimum; use a data/type composition",
      );
    if (spec.photo.subject) {
      const s = spec.photo.subject;
      const fit = Math.max(p.boxWidth / p.width, p.boxHeight / p.height);
      const visibleW = p.boxWidth / fit / p.width,
        visibleH = p.boxHeight / fit / p.height;
      const x = (1 - visibleW) * spec.photo.focal.x,
        y = (1 - visibleH) * spec.photo.focal.y;
      if (
        s.x < x ||
        s.y < y ||
        s.x + s.width > x + visibleW ||
        s.y + s.height > y + visibleH
      )
        metrics.issues.push(
          "Crop cuts protected rider/horse region; replan composition",
        );
    }
  }
  if (spec.sponsor) {
    const present = await page
      .locator("[data-sponsor]")
      .getAttribute("data-sponsor");
    if (present !== spec.sponsor.asset.id)
      metrics.issues.push("Sponsor not rendered");
  }
  return {
    passed: !metrics.issues.length,
    issues: [...new Set(metrics.issues)],
    textElements: metrics.textElements,
    minContrast: metrics.minContrast,
    logoRatio: metrics.logoRatio,
    safeArea: {
      top: vertical ? safeTop : 40,
      bottom: vertical ? safeBottom : 40,
    },
    photoCrop: spec.photo
      ? spec.photo.subject
        ? "protected subject checked"
        : "focal crop; subject semantics require visual review"
      : "no documentary photograph; explicit demo label when simulated",
    visualReview: "required",
  };
}
