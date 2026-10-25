import { resolve } from "node:path";
import type { Asset, SkillOutputs } from "../domain/models.js";
import type { DesignRenderer } from "../providers/contracts.js";
import { ensure, hash } from "../common/core.js";
import { LocalRenderer } from "./renderer.js";
import { specFromPlan, truthFromEvent } from "./spec.js";
import type { Surface } from "./catalog.js";

/** Opt-in local renderer; never selects a model, approves or publishes. */
export class LocalDesignRenderer implements DesignRenderer {
  readonly renderer = new LocalRenderer();
  constructor(
    private output = resolve("outputs/render-demo"),
    private targets?: Surface[],
  ) {}
  close() {
    return this.renderer.close();
  }
  async render(
    plan: SkillOutputs["social-designer"],
    sources: Asset[],
    context?: {
      event: SkillOutputs["polo-news-researcher"];
      eventVersion?: number;
      recentFamilies?: string[];
    },
  ): Promise<Asset[]> {
    ensure(
      context?.event,
      "Local renderer requires the authoritative event ledger",
    );
    const truth = truthFromEvent(context.event, context.eventVersion);
    const surfaces: Surface[] = this.targets ?? [
      plan.output.structure === "story" ? "story" : "feed",
    ];
    const rendered: Asset[] = [];
    for (const surface of surfaces) {
      const spec = specFromPlan(
        plan,
        truth,
        surface,
        sources,
        context.recentFamilies,
      );
      if (surface === "story")
        spec.decision.family = spec.photo
          ? "result-photo-dominant"
          : "story-result";
      if (surface === "reel_cover")
        spec.decision.family = spec.photo
          ? "reel-cover-action"
          : "reel-cover-result";
      const result = await this.renderer.render(
        spec,
        truth,
        this.output,
        `${surface}-${truth.eventId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50)}-${hash(spec).slice(0, 12)}`,
      );
      rendered.push({
        id: `local-render-${result.key.slice(0, 20)}`,
        type: "graphic",
        stage: "rendered",
        storageRef: result.png,
        rights: "owned",
        source: "LocalDesignRenderer",
        required: true,
        credit: null,
        metadata: {
          actualMedia: true,
          simulated: truth.simulated,
          demoPlaceholder: spec.provenance.demoPlaceholder,
          compositionFamily: spec.decision.family,
          surface,
          sha256: result.pngSha256,
          width: spec.width,
          height: spec.height,
          mimeType: "image/png",
          renderKey: result.key,
          renderManifest: result.manifest,
          renderQA: result.qa,
          sourceIds: sources.map((a) => a.id),
        },
      });
    }
    return rendered;
  }
}
