import { dataUri, productionMark } from "./brand.js";
import { resolveFinish } from "./finish.js";
import type { RenderSpec } from "./spec.js";
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const text = (s: string, cls: string, bg: string, tag = "div") =>
  `<${tag} class="${cls}" data-check="text" data-bg="${bg}">${esc(s)}</${tag}>`;
export function finishLayers() {
  return '<div class="finish-wash"></div><div class="finish-plane"></div><div class="finish-grid"></div><div class="finish-horizon"></div><div class="finish-orbit"></div><div class="finish-ticks"></div>';
}
export function polishedResultHTML(spec: RenderSpec, styles: string): string {
  const f = resolveFinish("production", spec.finish),
    dark = spec.decision.theme === "dark",
    mark = productionMark(spec.decision.theme),
    score = spec.content.score!;
  const bg = dark ? "#174c7b" : "#dbeef9",
    t = (s: string, cls: string, tag = "div") => text(s, cls, bg, tag);
  const icon = `<img data-logo="${mark.id}" class="production-logo" width="112" height="112" src="${dataUri(mark.path)}" alt="Polo Connect">`;
  const header = `<header class="production-header">${icon}<div class="production-brand">${t("POLO CONNECT", "brand-name")}${t("POLO / COMUNIDAD", "brand-descriptor")}</div><div class="edition-mark">${t("RESULTADOS", "edition-label")}<span class="edition-dot"></span></div></header>`;
  const context = `<div class="production-context"><div class="context-rule"></div>${t(spec.content.tournament, "tournament-name")}${spec.surface === "reel_cover" ? "" : t(spec.content.stage, "stage-label")}</div>`;
  const names = `<div class="pair-names">${t(score.home, "pair-name")}${t(score.away, "pair-name")}</div>`;
  const pair = `<div class="score-pair">${t(String(score.homeScore), "pair-score home-score")}${t("—", "score-dash")}${t(String(score.awayScore), "pair-score away-score")}</div>`;
  let body = "";
  if (spec.surface === "story") {
    body =
      t(spec.content.eyebrow, "production-kicker") +
      t(spec.content.stage, "story-title") +
      `<div class="story-result-panel">${names}${pair}<div class="panel-baseline"></div></div>` +
      context;
  } else if (spec.surface === "reel_cover") {
    body =
      t(spec.content.stage, "production-kicker") +
      t(score.home, "cover-headline", "h1") +
      t("VS " + score.away, "cover-opponent") +
      `<div class="cover-score-panel">${pair}<div class="cover-play" aria-hidden="true"><i></i></div></div>` +
      context;
  } else {
    body =
      t(spec.content.eyebrow, "production-kicker") +
      `<div class="feed-result-panel"><div class="result-row home-row">${t(score.home, "result-name")}${t(String(score.homeScore), "result-score")}</div><div class="result-row away-row">${t(score.away, "result-name")}${t(String(score.awayScore), "result-score")}</div></div>` +
      context;
  }
  const classes = `production-result ${spec.surface} theme-${spec.decision.theme} depth-${f.depth_level} accent-${f.accent_intensity} graphics-${f.graphic_density} energy-${f.brand_energy} complexity-${f.background_complexity} intensity-${spec.decision.brandIntensity}`;
  const vars = `--height:${(spec.height / spec.width) * 1080}px;--scale:${spec.width / 1080};--bg:${dark ? "#081a32" : "#f0f7fc"};--fg:${dark ? "#ffffff" : "#081a32"};--muted:${dark ? "#c2e5fa" : "#244d6a"};--sky:${dark ? "#80d8ff" : "#075787"};--panel:${dark ? "#12395e" : "#deeffa"};--panel-dark:${dark ? "#0b213c" : "#f5fbff"};--line:${dark ? "#37678e" : "#9bcbe6"};--accent:#42b9f5`;
  const footer = `<footer class="production-footer">${t(spec.provenance.simulated ? "DEMO · DATOS FICTICIOS" : "POLO CONNECT / EDITORIAL", "production-note")}${t(spec.surface === "reel_cover" ? "PLAY / PC" : "POLO CONNECT", "production-signature")}</footer>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'none'"><style>${styles}</style></head><body><article id="art" class="${classes}" style="${vars}">${finishLayers()}${header}<main data-critical="true" class="production-main">${body}</main>${footer}</article></body></html>`;
}
