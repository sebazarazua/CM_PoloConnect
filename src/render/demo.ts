import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { CommunityManagerOrchestrator } from "../orchestration/community-manager.js";
import { MemoryRepository, FileRepository } from "../persistence/repository.js";
import { mockProviders, demoEvent } from "../providers/mock/index.js";
import { runAIDemo } from "../workflows/demo.js";
import { current, isReelPlan } from "../domain/models.js";
import { loadConfig } from "../config/index.js";
import { selectedAISettings, selectedExecutor } from "../ai/factory.js";
import { usageReport } from "../ai/usage.js";
import { LocalDesignRenderer } from "./provider.js";
import { families, surfaces, type Family, type Surface } from "./catalog.js";
import {
  specFromPlan,
  truthFromEvent,
  assertCarousel,
  type TruthRecord,
  type RenderSpec,
} from "./spec.js";
import { LocalRenderer, type RenderReceipt } from "./renderer.js";
import { escapeHTML } from "./html.js";
import { loadBrand } from "./brand.js";
import { redact } from "../common/core.js";
import type { RenderMode } from "./finish.js";

export function gallerySpec(
  base: RenderSpec,
  truth: TruthRecord,
  family: Family,
  index: number,
): { spec: RenderSpec; truth: TruthRecord } {
  const item = families[family];
  const surface: Surface =
    item.group === "story"
      ? "story"
      : item.group === "reel_cover"
        ? "reel_cover"
        : item.group === "carousel"
          ? "carousel"
          : index % 5 === 0
            ? "square"
            : "feed";
  const spec = structuredClone(base),
    ledger = structuredClone(truth);
  spec.id = family;
  spec.surface = surface;
  [spec.width, spec.height] = surfaces[surface];
  spec.decision = {
    ...spec.decision,
    family,
    theme: family === "result-minimal" || index % 3 === 1 ? "light" : "dark",
    brandIntensity:
      index % 3 === 0 ? "subtle" : index % 3 === 1 ? "standard" : "strong",
    visualCarrier: item.photo
      ? "photo"
      : item.layout === "quote"
        ? "quote"
        : item.layout === "stat" || item.layout === "comparison"
          ? "data"
          : item.group === "result" || family.endsWith("-result")
            ? "score"
            : "type",
  };
  spec.logo = "icon";
  spec.photo = null;
  spec.provenance.demoPlaceholder = true;
  spec.content.eyebrow = {
    result: "RESULTADO",
    fixture: "PRÓXIMO PARTIDO",
    news: family === "news-breaking" ? "ÚLTIMO MOMENTO" : "ACTUALIDAD",
    player: "JUGADORES",
    horse: "CABALLOS",
    story: "POLO / AHORA",
    reel_cover: "EN FOCO",
    carousel: "EL PARTIDO EN DATOS",
  }[item.group];
  const headlines: Record<string, string> = {
    result: "Resultado final",
    fixture: "La próxima fecha",
    news:
      family === "news-announcement"
        ? "Una nueva temporada"
        : "El polo, más cerca",
    player: "Jugador Demo",
    horse: "Caballo Demo",
    story:
      family === "story-link-replay"
        ? "Volvé a ver el partido"
        : family === "story-poll-question"
          ? "¿Qué jugada elegís?"
          : "Hoy juega el polo",
    reel_cover: "Así se definió",
    carousel:
      family === "carousel-conclusion"
        ? "Lo que viene"
        : family === "carousel-context"
          ? "Un partido de dos ritmos"
          : "El juego, en cifras",
  };
  spec.content.headline = headlines[item.group]!;
  spec.content.subhead =
    item.layout === "context"
      ? "La ventaja se construyó en la segunda mitad. Una lectura editorial del encuentro ficticio."
      : "";
  spec.content.quote =
    item.layout === "quote"
      ? {
          text: "El equipo está por encima de cualquier nombre.",
          attribution: "Jugador Demo · Cita ficticia",
        }
      : null;
  spec.content.stats =
    item.layout === "stat" || item.layout === "comparison"
      ? [
          { label: "Team Azul", value: "12", unit: "goles" },
          { label: "Team Blanco", value: "10", unit: "goles" },
        ]
      : [];
  spec.content.schedule =
    item.layout === "schedule"
      ? [
          { label: "Team Azul — Team Blanco", value: "18:00" },
          { label: "Team Norte — Team Sur", value: "20:00" },
        ]
      : [];
  ledger.stage =
    item.group === "fixture"
      ? "PRÓXIMA FECHA"
      : item.group === "news"
        ? "ACTUALIDAD"
        : item.group === "player"
          ? "PERFIL"
          : item.group === "horse"
            ? "CRÍA Y DEPORTE"
            : item.group === "carousel"
              ? "LECTURA DEL PARTIDO"
              : item.group === "reel_cover" && family !== "reel-cover-result"
                ? "EN FOCO"
                : item.group === "story" && family !== "story-result"
                  ? "COMUNIDAD"
                  : "FINAL";
  spec.content.stage = ledger.stage;
  if (!["result", "story", "reel_cover", "fixture"].includes(item.group))
    spec.content.score = null;
  spec.interaction =
    family === "story-poll-question"
      ? "poll"
      : family === "story-link-replay"
        ? "link"
        : "none";
  if (item.group === "carousel")
    spec.carousel = {
      id: "demo-carousel",
      index: 1,
      total: 1,
      continuity: "polo-editorial-v1",
    };
  else spec.carousel = null;
  ledger.approvedDisplay.push(
    spec.content.headline,
    spec.content.subhead,
    ...(spec.content.quote
      ? [spec.content.quote.text, spec.content.quote.attribution]
      : []),
    ...spec.content.stats.flatMap((s) => [s.label, s.value, s.unit]),
    ...spec.content.schedule.flatMap((s) => [s.label, s.value]),
  );
  return { spec, truth: ledger };
}
export function galleryHTML(
  items: { name: string; spec: RenderSpec; receipt: RenderReceipt }[],
): string {
  const edition =
    items[0]?.spec.mode === "study"
      ? "Estudio visual"
      : "Edición de producción";
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Polo Connect · ${edition}</title><style>body{margin:0;background:#070d25;color:white;font:16px system-ui}header{padding:48px 5vw 28px;border-bottom:1px solid #2d5377}h1{font-size:44px;margin:0 0 16px}p{color:#b7c9d9;max-width:900px;line-height:1.6}nav{padding:24px 5vw;display:flex;gap:16px;flex-wrap:wrap}select{padding:12px;background:#12223c;color:white;border:1px solid #2d5377}main{padding:0 5vw 64px;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:36px}figure{margin:0}figure img{width:100%;height:420px;object-fit:contain;object-position:top;background:#12223c}figcaption{padding:16px 0;line-height:1.6}small{color:#b7c9d9}a{color:#8ebcff}figure[hidden]{display:none}footer{padding:32px 5vw;color:#b7c9d9}</style><header><h1>Polo Connect / ${edition}</h1><p>Isotipo normalizado · sistema editorial con profundidad controlada · HTML/CSS real. Todos los datos son ficticios. Los espacios de fotografía están identificados como placeholders; no representan partidos ni personas. Elegir una composición no equivale a aprobar su publicación.</p></header><nav><label>Superficie <select id="surface"><option value="">Todas</option>${Object.keys(
    surfaces,
  )
    .map((s) => `<option>${s}</option>`)
    .join(
      "",
    )}</select></label><label>Tema <select id="theme"><option value="">Todos</option><option>dark</option><option>light</option></select></label></nav><main>${items.map(({ name, spec, receipt }) => `<figure data-surface="${spec.surface}" data-theme="${spec.decision.theme}"><a href="${encodeURIComponent(name)}.png"><img src="${encodeURIComponent(name)}.png" loading="lazy" alt="${escapeHTML(spec.decision.family)} · demostración"></a><figcaption>${escapeHTML(name)}<br><small>${spec.width}×${spec.height} · ${spec.decision.theme} · ${spec.decision.brandIntensity}<br>QA técnico: ${receipt.qa.passed ? "PASS" : "BLOCK"} · contraste ≥ ${receipt.qa.minContrast.toFixed(1)}</small><br><a href="${encodeURIComponent(name)}.jpg">JPG</a> · <a href="${encodeURIComponent(name)}.manifest.json">Spec + QA</a></figcaption></figure>`).join("")}</main><footer>Sin publicación · revisión visual/editorial y aprobación humana pendientes. Safe areas conservadoras, sujetas a la UI de la ruta final.</footer><script>for(const el of document.querySelectorAll('select'))el.onchange=()=>{for(const item of document.querySelectorAll('figure'))item.hidden=(surface.value&&item.dataset.surface!==surface.value)||(theme.value&&item.dataset.theme!==theme.value)}</script></html>`;
}
export async function renderDemo(
  options: {
    gallery?: boolean;
    realAI?: boolean;
    outDir?: string;
    mode?: RenderMode;
  } = {},
) {
  const mode = options.mode ?? "production";
  const out = resolve(
    options.outDir ??
      (mode === "production"
        ? "outputs/production-v2"
        : "outputs/design-study"),
  );
  mkdirSync(out, { recursive: true });
  const design = new LocalDesignRenderer(
      out,
      ["feed", "story", "reel_cover"],
      mode,
    ),
    renderer = new LocalRenderer(),
    repository = options.realAI
      ? new FileRepository(resolve(`.local/visual-ai-demo-${mode}.json`))
      : new MemoryRepository();
  const ai = selectedAISettings();
  const executor = options.realAI ? selectedExecutor(ai) : undefined;
  const cm = new CommunityManagerOrchestrator(
    repository,
    { ...mockProviders(), design },
    executor,
    loadConfig(),
    ai,
  );
  try {
    const content = await runAIDemo(cm);
    const plan = current(content.plans)?.data;
    if (!plan || isReelPlan(plan))
      throw new Error("No social design plan produced; inspect blockers");
    const truth = truthFromEvent(demoEvent().candidate);
    const items: { name: string; spec: RenderSpec; receipt: RenderReceipt }[] =
      [];
    for (const [surface, name] of [
      ["feed", "feed-result"],
      ["story", "story-result"],
      ["reel_cover", "reel-cover"],
      ["square", "square-result"],
    ] as const) {
      const spec = specFromPlan(plan, truth, surface);
      spec.mode = mode;
      if (surface === "story") spec.decision.family = "story-result";
      if (surface === "reel_cover") spec.decision.family = "reel-cover-result";
      const receipt = await renderer.render(spec, truth, out, name);
      items.push({ name, spec, receipt });
      writeFileSync(
        resolve(out, name + ".spec.json"),
        JSON.stringify(spec, null, 2) + "\n",
      );
    }
    const carousel: { spec: RenderSpec; truth: TruthRecord }[] = [];
    if (options.gallery) {
      for (const [i, family] of (Object.keys(families) as Family[]).entries()) {
        const sample = gallerySpec(items[0]!.spec, truth, family, i);
        if (families[family].group === "carousel") {
          carousel.push(sample);
          continue;
        }
        const receipt = await renderer.render(
          sample.spec,
          sample.truth,
          out,
          "family-" + family,
        );
        items.push({ name: "family-" + family, spec: sample.spec, receipt });
      }
      carousel.forEach((s, i) => {
        s.spec.carousel = {
          id: "demo-carousel",
          index: i + 1,
          total: carousel.length,
          continuity: "polo-editorial-v1",
        };
        s.spec.decision.theme = "dark";
        s.spec.surface = "carousel";
      });
      assertCarousel(carousel.map((c) => c.spec));
      for (const sample of carousel) {
        const receipt = await renderer.render(
          sample.spec,
          sample.truth,
          out,
          "family-" + sample.spec.id,
        );
        items.push({
          name: "family-" + sample.spec.id,
          spec: sample.spec,
          receipt,
        });
      }
    }
    writeFileSync(resolve(out, "index.html"), galleryHTML(items));
    writeFileSync(resolve(out, "truth.json"), JSON.stringify(truth, null, 2));
    const previewFiles = await Promise.all(
      items.slice(0, 3).map(async (item, i) => ({
        input: await sharp(item.receipt.png)
          .resize({
            width: 360,
            height: 640,
            fit: "contain",
            background: "#070d25",
          })
          .png()
          .toBuffer(),
        left: i * 380 + 20,
        top: 20,
      })),
    );
    await sharp({
      create: { width: 1160, height: 680, channels: 3, background: "#070d25" },
    })
      .composite(previewFiles)
      .png()
      .toFile(resolve(out, "preview.png"));
    const state = await repository.read();
    const report = {
      renderMode: mode,
      mode: options.realAI
        ? "real_ai_local_render"
        : "fixture_planning_real_pixels",
      brand: loadBrand().version,
      outputs: items.map((i) => ({
        family: i.spec.decision.family,
        ...i.receipt,
      })),
      contentStatus: content.status,
      approval: "required_pending",
      publishing: "disabled",
      photo:
        "explicit abstract placeholder; no authentic sports photo supplied",
      visualReview: options.realAI
        ? "Selected live AI receives final feed, Story and Reel cover PNGs; inspect ledger/blockers"
        : "fixture executor only; visual model review not executed",
      usage: usageReport(state),
      cacheHits: items.filter((i) => i.receipt.cached).length,
    };
    writeFileSync(
      resolve(out, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    writeFileSync(
      resolve(out, "workflow.json"),
      JSON.stringify(state, null, 2) + "\n",
    );
    return {
      renderMode: mode,
      directory: out,
      gallery: resolve(out, "index.html"),
      outputs: items.length,
      renderCacheHits: report.cacheHits,
      mode: report.mode,
      status: content.status,
      approval: report.approval,
      visualReview: report.visualReview,
      publishing: "disabled",
    };
  } catch (error) {
    const state = await repository.read();
    writeFileSync(
      resolve(out, "workflow.json"),
      JSON.stringify(state, null, 2),
    );
    writeFileSync(
      resolve(out, "failure-report.json"),
      JSON.stringify(
        redact({
          error:
            error instanceof Error ? error.message : "Render workflow failed",
          usage: usageReport(state),
          publishing: "disabled",
          approval: "not_granted",
        }),
        null,
        2,
      ),
    );
    throw error;
  } finally {
    await design.close();
    await renderer.close();
  }
}
