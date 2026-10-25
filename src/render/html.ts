import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dataUri, loadBrand, productionMark } from "./brand.js";
import { finishLayers, polishedResultHTML } from "./production.js";
import { resolveFinish } from "./finish.js";
import { families } from "./catalog.js";
import type { RenderSpec } from "./spec.js";
export const escapeHTML = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const txt = (value: string, cls: string, bg: string, tag = "div") =>
  `<${tag} class="${cls}" data-check="text" data-bg="${bg}">${escapeHTML(value)}</${tag}>`;
export function artHTML(spec: RenderSpec): string {
  const brand = loadBrand(),
    c = brand.colors,
    d = spec.decision,
    content = spec.content;
  const dark = d.theme === "dark",
    bg = dark ? c["brand.navy"]! : c["surface.light"]!,
    fg = dark ? "#ffffff" : c["brand.navy"]!,
    muted = dark ? "#b7c9d9" : "#3b5269";
  const score = dark ? "#ffffff" : c["brand.darkBlue"]!,
    accent = c["brand.brightBlue"]!,
    line = dark ? "#2d5377" : "#cad5df";
  const logo = productionMark(d.theme);
  const font = (name: string, family: string, weight: number) =>
    `@font-face{font-family:${family};font-weight:${weight};font-style:normal;src:url('${dataUri(resolve("brand/assets/fonts", name))}') format('truetype');font-display:block}`;
  const faces =
    font("Barlow-Regular.ttf", "Barlow", 400) +
    font("Barlow-SemiBold.ttf", "Barlow", 600) +
    font("BarlowCondensed-Bold.ttf", "Display", 700) +
    font("BarlowCondensed-SemiBold.ttf", "Display", 600);
  const css =
    readFileSync(resolve("src/render/layout.css"), "utf8") +
    readFileSync(resolve("src/render/finish.css"), "utf8");
  const layout = families[d.family].layout;
  const mode = spec.mode ?? "production";
  const finish = resolveFinish(mode, spec.finish);
  if (
    mode === "production" &&
    spec.content.score &&
    !spec.photo &&
    ["score", "minimal"].includes(layout) &&
    !spec.sponsor &&
    spec.interaction === "none"
  )
    return polishedResultHTML(spec, faces + css);
  const context = `<section class="context">${txt(content.stage, "stage", bg)}${txt(content.tournament, "tournament", bg)}</section>`;
  const headline = txt(content.headline, "headline", bg, "h1");
  const scoreHTML = content.score
    ? `<section class="scoreboard">${[0, 1].map((i) => `<div class="team">${txt(i === 0 ? content.score!.home : content.score!.away, "name", bg)}${txt(String(i === 0 ? content.score!.homeScore : content.score!.awayScore), "points", bg)}</div>`).join("")}</section>`
    : "";
  const photo = spec.photo
    ? `<div class="hero"><img data-photo="true" alt="${escapeHTML(spec.photo.credit ?? "Fotografía autorizada")}" src="${dataUri(spec.photo.path)}" class="photo-${d.photoTreatment}" style="--focal-x:${spec.photo.focal.x * 100}%;--focal-y:${spec.photo.focal.y * 100}%"></div>`
    : `<div class="placeholder"><div class="field-line"></div>${txt("ESPACIO PARA FOTO", "", dark ? "#12223c" : "#e7edf2", "strong")}${txt("DEMO · SIN FOTOGRAFÍA", "", dark ? "#12223c" : "#e7edf2", "span")}</div>`;
  const stat = (i: number) => {
    const s = content.stats[i]!;
    return `<div class="stat">${txt(s.label, "stat-label", bg)}<div>${txt(s.value, "stat-number", bg, "span")}${s.unit ? txt(s.unit, "unit", bg, "span") : ""}</div></div>`;
  };
  let body = "";
  switch (layout) {
    case "photo":
      body = photo + (content.score ? scoreHTML : headline) + context;
      break;
    case "score":
    case "minimal":
      body = scoreHTML + context;
      break;
    case "quote":
      body =
        `<div class="quote-mark" aria-hidden="true">“</div>` +
        txt(content.quote!.text, "quote-text", bg) +
        txt(content.quote!.attribution, "attribution", bg) +
        context;
      break;
    case "stat":
      body = headline + stat(0) + context;
      break;
    case "comparison":
      body =
        headline +
        `<div class="comparison">${stat(0)}${stat(1)}</div>` +
        context;
      break;
    case "schedule":
      body =
        headline +
        `<section class="schedule">${content.schedule.map((row) => `<div class="schedule-row">${txt(row.label, "", bg, "span")}${txt(row.value, "", bg, "strong")}</div>`).join("")}</section>` +
        context;
      break;
    case "matchup":
      body =
        `<div class="matchup">${txt(content.score?.home ?? content.headline, "team-name", bg)}${txt("VS", "versus", bg)}${txt(content.score?.away ?? content.subhead, "team-name", bg)}</div>` +
        context;
      break;
    default:
      body =
        headline +
        (content.subhead ? txt(content.subhead, "deck", bg) : "") +
        context;
  }
  const label = spec.provenance.simulated
    ? "DEMO · DATOS FICTICIOS"
    : "POLO / ACTUALIDAD";
  const logoHTML = `<img data-logo="${logo.id}" class="logo icon" width="112" height="112" alt="Polo Connect" src="${dataUri(logo.path)}">`;
  const sponsor = spec.sponsor
    ? `<div class="sponsor"><div class="sponsor-label">${escapeHTML(spec.sponsor.name)}</div><img data-sponsor="${escapeHTML(spec.sponsor.asset.id)}" src="${dataUri(spec.sponsor.asset.path)}" alt="${escapeHTML(spec.sponsor.name)}"></div>`
    : "";
  const credit = spec.photo?.credit
    ? `<div class="credit">${escapeHTML(spec.photo.credit)}</div>`
    : "";
  const vertical = ["story", "reel_cover"].includes(spec.surface);
  const classes = [
    "finish-" + mode,
    "theme-" + d.theme,
    "depth-" + finish.depth_level,
    "accent-" + finish.accent_intensity,
    "graphics-" + finish.graphic_density,
    "energy-" + finish.brand_energy,
    "complexity-" + finish.background_complexity,
    "family-" + d.family,
    "hierarchy-" + d.hierarchy[0],
    "density-" + d.density,
    vertical ? "vertical" : "",
    spec.surface,
    layout === "photo"
      ? "photo-layout"
      : layout === "headline"
        ? "headline-layout"
        : layout === "context"
          ? "context-layout"
          : layout,
    d.brandIntensity ? "intensity-" + d.brandIntensity : "",
    spec.interaction !== "none" ? "has-interaction" : "",
    spec.sponsor ? "has-sponsor" : "",
    d.family.includes("breaking") ? "breaking" : "",
    d.family.includes("live") ? "live" : "",
  ].join(" ");
  const vars = `--height:${(spec.height / spec.width) * 1080}px;--scale:${spec.width / 1080};--bg:${bg};--fg:${fg};--muted:${muted};--accent:${accent};--sky:${dark ? "#80d8ff" : "#075787"};--line:${line};--label:${dark ? "#b7c9d9" : "#2d5377"};--score:${score};--status:${dark ? "#ff8794" : "#a71d32"};--photo-bg:${dark ? "#12223c" : "#e7edf2"}`;
  const folio = {
    result: "RESULT",
    fixture: "FIXTURE",
    news: "NEWS",
    player: "PLAYER",
    horse: "HORSE",
    reel_cover: "PLAY",
    story: "STORY",
    carousel: "SERIES",
  }[families[d.family].group];
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'none'"><style>${faces}${css}</style></head><body><article id="art" class="${classes}" style="${vars}">${mode === "production" ? finishLayers() : ""}<div class="brand-stripe"></div><div class="arc"></div><header>${logoHTML}<div class="edition">${txt(mode === "study" ? "ESTUDIO / 01" : "POLO / COMUNIDAD", "", bg)}${txt(label, "muted", bg)}</div></header><main data-critical="true">${txt(content.eyebrow, "eyebrow", bg)}${body}</main>${spec.interaction !== "none" ? `<div class="interaction">ESPACIO ${spec.interaction.toUpperCase()} · AÑADIR EN INSTAGRAM</div>` : ""}<footer><div class="footer-copy">${txt(spec.provenance.demoPlaceholder && mode === "study" ? "ESTUDIO DE DISEÑO · PLACEHOLDER" : "POLO / EDITORIAL", "", bg)}${credit}</div>${sponsor}<div class="folio">${spec.carousel ? String(spec.carousel.index).padStart(2, "0") + " / " + String(spec.carousel.total).padStart(2, "0") : "PC / " + folio}</div></footer></article></body></html>`;
}
