import { statSync } from "node:fs";
import { extname } from "node:path";
import type { Asset } from "../domain/models.js";
import { ensure } from "../common/core.js";
import { fileDigest } from "./brand.js";
import { localPath } from "./spec.js";
export interface VisualInput {
  assetId: string;
  path: string;
  sha256: string;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
  byteLength: number;
  detail: "high";
}
export function finalRenderInputs(assets: Asset[]): VisualInput[] {
  const rendered = assets.filter(
    (a) =>
      a.stage === "rendered" &&
      a.type === "graphic" &&
      a.metadata.actualMedia === true,
  );
  ensure(
    rendered.length <= 6,
    "Visual QA needs an explicit batch for more than six renders",
  );
  return rendered.map((a) => {
    const path = localPath(a.storageRef),
      ext = extname(path).toLowerCase();
    ensure(
      [".png", ".jpg", ".jpeg"].includes(ext),
      "Visual reviewer accepts final PNG/JPG only",
    );
    ensure(
      ["owned", "licensed", "permission_confirmed"].includes(a.rights),
      "Visual render rights unresolved",
    );
    const sha256 = fileDigest(path);
    ensure(
      sha256 === a.metadata.sha256,
      "Final render changed since version binding",
    );
    const byteLength = statSync(path).size;
    ensure(
      byteLength <= 16 * 1024 * 1024,
      "Visual asset exceeds local QA batch size",
    );
    const width = Number(a.metadata.width),
      height = Number(a.metadata.height);
    ensure(width > 0 && height > 0, "Final render dimensions unavailable");
    ensure(
      (a.metadata.renderQA as { passed?: boolean })?.passed === true,
      "Deterministic render QA did not pass",
    );
    return {
      assetId: a.id,
      path,
      sha256,
      mime: ext === ".png" ? "image/png" : "image/jpeg",
      width,
      height,
      byteLength,
      detail: "high",
    };
  });
}
