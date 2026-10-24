import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensure, hash } from "../common/core.js";
import {
  current,
  type SkillName,
  type SkillOutputs,
} from "../domain/models.js";
import type { SkillBundle, SkillExecutor, SkillInput } from "./runtime.js";

/** Deterministic test double. It simulates contracts, never claims to perform editorial intelligence. */
export class FixtureSkillExecutor implements SkillExecutor {
  readonly name = "fixture";
  readonly version = "1";
  readonly model = null;
  constructor(private root = resolve("fixtures/skill-outputs")) {}
  private fixture<K extends SkillName>(name: K): SkillOutputs[K] {
    return JSON.parse(
      readFileSync(resolve(this.root, `${name}.json`), "utf8"),
    ) as SkillOutputs[K];
  }
  async execute(bundle: SkillBundle, input: SkillInput): Promise<unknown> {
    const event = input.event;
    switch (bundle.name) {
      case "polo-news-researcher":
        ensure(input.candidate, "Missing candidate");
        return input.candidate;
      case "benchmark-researcher":
        return this.fixture("benchmark-researcher");
      case "editorial-strategist": {
        const p = this.fixture("editorial-strategist");
        p.plan_id = `demo-plan-${hash(input.context).slice(0, 12)}`;
        p.feedback_context = input.context;
        p.simulated = true;
        return p;
      }
      case "content-opportunity-detector": {
        ensure(event, "Missing event");
        const p = this.fixture("content-opportunity-detector");
        p.opportunity_id = `opp-${event.event_id}-${input.format ?? "single_image"}`;
        p.source_candidates = [
          { source_type: "news_event", source_id: event.event_id },
        ];
        p.format.preferred = input.format ?? "single_image";
        p.handoff.downstream_skill =
          input.format === "reel" ? "reel-planner" : "social-designer";
        p.assets.required_assets =
          input.assets?.filter((a) => a.required).map((a) => a.id) ?? [];
        p.handoff.required_facts = event.claims.map((c) => c.claim);
        p.timing.expires_at = null;
        p.timing.latest_publish_at = null;
        p.timing.earliest_publish_at = null;
        return p;
      }
      case "social-designer": {
        ensure(input.opportunity, "Missing opportunity");
        const p = this.fixture("social-designer");
        p.opportunity_id = input.opportunity.opportunity_id;
        p.design_id = `design-${p.opportunity_id}`;
        p.assets = (input.assets ?? []).map((a) => ({
          asset_id: a.id,
          role: a.type,
          rights_status: a.rights,
          required: a.required,
          path_or_url: a.storageRef,
          credit: a.credit,
        }));
        p.slides = p.slides.map((s) => ({
          ...s,
          asset_ids: p.assets.map((a) => a.asset_id),
          primary_message: event?.claims[0]?.claim ?? s.primary_message,
          display_text: event?.claims.map((c) => c.claim) ?? s.display_text,
        }));
        if (input.format === "carousel") {
          p.output.structure = "carousel";
          p.slides = [
            p.slides[0]!,
            { ...p.slides[0]!, index: 2, function: "context" },
          ];
          p.output.slide_count = 2;
        }
        if (input.format === "story") p.output.structure = "story";
        p.visual_system.color_roles = [
          "Pendiente del brand system; fixture sin diseño final",
        ];
        p.visual_system.type_roles = ["Pendiente de tipografía aprobada"];
        p.simulated = true;
        return p;
      }
      case "reel-planner": {
        ensure(input.opportunity, "Missing opportunity");
        const p = this.fixture("reel-planner");
        p.opportunity_id = input.opportunity.opportunity_id;
        p.reel_id = `reel-${p.opportunity_id}`;
        const asset = input.assets?.find((a) => a.type === "video");
        ensure(asset, "Missing fixture clip");
        const previous = p.footage[0]?.source_id;
        p.footage = p.footage.map((c) => ({
          ...c,
          source_id: asset.id,
          source_path: asset.storageRef,
          rights_status: asset.rights,
        }));
        p.hook.source_id = asset.id;
        p.narrative.beats = p.narrative.beats.map((b) => ({
          ...b,
          source_id: b.source_id === previous ? asset.id : b.source_id,
        }));
        p.rights.video_status = asset.rights;
        p.text.overlays = event?.claims.map((c) => c.claim) ?? [];
        p.cover.source_frame = `${asset.id}@00:00:00`;
        p.cover.headline = event?.headline_working ?? "Torneo Demo";
        p.simulated = true;
        return p;
      }
      case "copywriter": {
        ensure(event && input.opportunity, "Missing copy context");
        const p = this.fixture("copywriter");
        p.copy_id = `copy-${input.opportunity.opportunity_id}`;
        p.opportunity_id = input.opportunity.opportunity_id;
        p.source_facts = event.claims.map((c, i) => ({
          fact_id: `fact-${i}`,
          fact: c.claim,
          verification_status: c.status,
          source_id: c.source_ids[0] ?? null,
        }));
        p.outputs.caption = `${event.claims[0]?.claim}. Torneo Demo. Contenido ficticio de prueba.`;
        p.outputs.headline = event.headline_working;
        p.outputs.overlays = event.claims.map((c) => c.claim);
        p.outputs.cta = null;
        p.outputs.hashtags = [];
        p.outputs.mentions = [];
        p.simulated = true;
        return p;
      }
      case "quality-reviewer": {
        const c = input.content;
        ensure(c && event, "Missing QA context");
        const p = this.fixture("quality-reviewer");
        p.review_id = `review-${c.id}-${c.versions.review + 1}`;
        p.content_id = c.id;
        p.review_stage = input.stage ?? "post_render";
        p.review_mode = "full";
        p.scope.missing_inputs = [];
        p.scope.publishing_route = "mock";
        p.versions = {
          asset_version: String(c.versions.asset),
          copy_version: String(c.versions.copy),
          metadata_version: String(c.versions.metadata),
        };
        p.source_of_truth = event.claims.map((f, i) => ({
          fact_id: `fact-${i}`,
          fact: f.claim,
          status: f.status,
        }));
        p.approval.state =
          input.stage === "pre_publish" ? "approved" : "required_pending";
        p.decision =
          input.stage === "pre_publish"
            ? "pass_for_publish"
            : "pass_for_human_approval";
        p.approval.approver =
          input.stage === "pre_publish"
            ? (c.approvals.at(-1)?.approver ?? null)
            : null;
        p.approval.approved_at =
          input.stage === "pre_publish"
            ? (c.approvals.at(-1)?.at ?? null)
            : null;
        p.issues = [];
        const expected = event.claims[0]?.claim;
        const copy = current(c.copies)?.data;
        if (expected && !copy?.source_facts.some((f) => f.fact === expected)) {
          p.decision = "blocked_verification";
          p.checks.facts = "fail";
          p.issues = [
            {
              issue_id: "score-conflict",
              severity: "blocker",
              category: "factual_consistency",
              surface: "copy",
              problem: "El resultado no coincide con el hecho verificado",
              impact: "Publicaría un resultado contradictorio",
              owner: "copywriter",
              required_fix:
                "Restaurar el score verificado en todas las superficies",
              recheck_scope: ["copy", "design", "metadata"],
              status: "open",
            },
          ];
        }
        p.simulated = true;
        return p;
      }
      case "performance-analyst": {
        ensure(input.snapshot, "Missing analytics snapshot");
        const p = this.fixture("performance-analyst");
        p.analysis_id = `analysis-${input.snapshot.id}`;
        p.scope.content_ids = [input.snapshot.contentId];
        p.metrics = input.snapshot.metrics;
        p.baselines = [];
        p.results = p.metrics.map((m) => ({
          statement: `Métrica de fixture ${m.name}: ${String(m.value)}; no implica resultados reales`,
          evidence_ids: [m.metric_id],
        }));
        p.data_quality = {
          status: "low",
          limitations: [
            "Datos simulados. Un solo contenido; sin baseline ni inferencia causal.",
          ],
          sources: ["MockAnalyticsProvider"],
        };
        p.diagnoses = [];
        p.learnings = [
          {
            learning_id: `learning-${input.snapshot.id}`,
            statement:
              "Hipótesis de prueba: evaluar claridad de resultado con una serie comparable antes de generalizar.",
            maturity: "internal_observation",
            confidence: "low",
            scope: "fixture ficticio Torneo Demo",
            sample_size: 1,
            next_test:
              "Repetir con tres piezas comparables y métricas reales autorizadas",
          },
        ];
        p.actions = [
          {
            action: "test_again",
            reason: "Un fixture no demuestra efectividad editorial",
            owner: "editorial-strategist",
          },
        ];
        p.handoffs = [
          {
            target_skill: "editorial-strategist",
            finding: p.learnings[0]!.statement,
            confidence: "low",
            scope: "demo",
            do_not_generalize: "Sólo prueba de infraestructura",
            next_validation: "Serie comparable real",
          },
        ];
        p.simulated = true;
        return p;
      }
    }
  }
}
