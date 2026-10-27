import { CMError, ensure, hash, id, now, redact } from "../common/core.js";
import { finalRenderInputs } from "../render/visual-input.js";
import { editorial, loadConfig, type Config } from "../config/index.js";
import {
  approve,
  invalidate,
  packageHash,
  pendingApproval,
} from "../approvals/service.js";
import {
  assertReadyForApproval,
  assertRights,
  publishPackage,
} from "../domain/guards.js";
import {
  current,
  isReelPlan,
  type Asset,
  type ContentItem,
  type EventRecord,
  type Publication,
  type Revision,
  type SkillOutputs,
  type Store,
} from "../domain/models.js";
import {
  canTransition,
  ownerFor,
  transition,
} from "../domain/state-machine.js";
import type { EditorialRepository } from "../persistence/repository.js";
import type { DiscoveredEvent, Providers } from "../providers/contracts.js";
import { FixtureSkillExecutor } from "../skills/fixture-executor.js";
import {
  SkillRegistry,
  SkillRunner,
  type SkillExecutor,
} from "../skills/runtime.js";

import { editorialSummary } from "../ai/context.js";
import { classify, BudgetExceeded } from "../ai/governance.js";
import { previewInput } from "../ai/preview.js";
import { DeterministicQualityGate } from "../qa/deterministic-gate.js";
import type { AISettings } from "../ai/types.js";

function revision<T>(version: number, data: T, input: unknown): Revision<T> {
  return {
    version,
    data: structuredClone(data),
    inputHash: hash(input),
    stale: false,
    at: now(),
  };
}
function normalizedUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const k of [...u.searchParams.keys()])
      if (k.startsWith("utm_") || k === "fbclid") u.searchParams.delete(k);
    u.searchParams.sort();
    return u.toString();
  } catch {
    return url;
  }
}
function materialEvent(data: SkillOutputs["polo-news-researcher"]): unknown {
  return {
    claims: data.claims.map((c) => ({ claim: c.claim, status: c.status })),
    entities: data.entities,
    time: data.time,
    headline: data.headline_working,
  };
}
function verified(data: SkillOutputs["polo-news-researcher"]): boolean {
  return (
    data.claims.length > 0 &&
    data.claims.every(
      (c) =>
        ["confirmed_primary", "confirmed_multi_source"].includes(c.status) &&
        c.source_ids.length > 0,
    )
  );
}

export class CommunityManagerOrchestrator {
  readonly runner: SkillRunner;
  constructor(
    readonly repository: EditorialRepository,
    readonly providers: Providers,
    executor: SkillExecutor = new FixtureSkillExecutor(),
    readonly config: Config = loadConfig(),
    ai?: AISettings,
    readonly taskBrief?: unknown,
  ) {
    ensure(
      providers.publishing.name === "mock",
      "This phase only accepts MockPublishingProvider",
    );
    this.runner = new SkillRunner(new SkillRegistry(), executor, config, ai);
  }
  private tx<T>(work: (store: Store) => Promise<T>): Promise<T> {
    return this.repository.transaction(async (s) => {
      try {
        return await work(s);
      } catch (e) {
        if (
          e instanceof BudgetExceeded &&
          e.contentId &&
          s.contents[e.contentId]
        ) {
          const c = s.contents[e.contentId]!;
          invalidate(s, c, "blocked_budget");
          c.blockers = [
            {
              code: "blocked_budget",
              owner: "human-budget-reviewer",
              detail: e.message,
              at: now(),
            },
          ];
          transition(s, c, "blocked", {
            workflowId: e.workflowId,
            reason: e.message,
          });
        }
        s.audit.push({
          id: id("audit"),
          contentId: null,
          kind: "workflow_error",
          at: now(),
          detail: {
            kind: e instanceof CMError ? e.kind : "permanent_error",
            message: redact(e instanceof Error ? e.message : String(e)),
          },
        });
        throw e;
      }
    });
  }
  private item(s: Store, contentId: string): ContentItem {
    const c = Object.hasOwn(s.contents, contentId)
      ? s.contents[contentId]
      : undefined;
    ensure(c, `Unknown content ${contentId}`);
    return c;
  }
  private context(s: Store, excludeId?: string): unknown {
    return {
      editorial,
      ...(this.taskBrief ? { taskBrief: this.taskBrief } : {}),
      ...(editorialSummary(s, this.runner.ai, excludeId) as object),
    };
  }
  private block(
    s: Store,
    c: ContentItem,
    code: string,
    detail: string,
    owner = ownerFor(code, c.type),
  ): ContentItem {
    c.reroutes++;
    invalidate(s, c, code);
    if (c.reroutes > this.config.maxReroutes) {
      code = "reroute_budget_exhausted";
      owner = "human-editor";
    }
    c.blockers = [{ code, owner, detail, at: now() }];
    transition(
      s,
      c,
      code === "blocked_assets" && canTransition(c.status, "awaiting_assets")
        ? "awaiting_assets"
        : "blocked",
      { code, owner, detail },
    );
    s.audit.push({
      id: id("audit"),
      contentId: c.id,
      kind: "blocker",
      at: now(),
      detail: c.blockers,
    });
    return c;
  }
  private createContent(
    s: Store,
    event: EventRecord,
    type: ContentItem["type"],
  ): ContentItem {
    const contentId = `content-${hash({ event: event.id, type }).slice(0, 24)}`;
    const existing = s.contents[contentId];
    if (existing) return existing;
    const c: ContentItem = {
      id: contentId,
      workflowClass: classify(event.data.event_type, type),
      eventId: event.id,
      title: event.data.headline_working,
      type,
      status: "detected",
      objective: "",
      audienceJob: "",
      priority: "P3",
      opportunityScore: null,
      createdAt: now(),
      updatedAt: now(),
      versions: { asset: 0, copy: 0, metadata: 1, review: 0 },
      opportunity: null,
      metadata: [
        revision(
          1,
          {
            eventRevision: event.revision,
            headline: event.data.headline_working,
            facts: event.data.claims,
            simulated: event.data.simulated === true,
          },
          event.fingerprint,
        ),
      ],
      plans: [],
      copies: [],
      assets: [],
      reviews: [],
      approvals: [],
      publications: [],
      snapshots: [],
      blockers: [],
      reroutes: 0,
    };
    s.contents[c.id] = c;
    transition(s, c, "researching");
    if (verified(event.data)) transition(s, c, "verified");
    else
      this.block(
        s,
        c,
        "blocked_verification",
        "Los hechos centrales requieren verificación primaria o independiente",
      );
    return c;
  }
  private invalidateEventDependents(s: Store, event: EventRecord): void {
    for (const c of Object.values(s.contents).filter(
      (c) => c.eventId === event.id && c.status !== "archived",
    )) {
      invalidate(s, c, "source_facts_changed");
      c.versions.metadata++;
      c.metadata.push(
        revision(
          c.versions.metadata,
          {
            ...current(c.metadata)?.data,
            eventRevision: event.revision,
            headline: event.data.headline_working,
            facts: event.data.claims,
          },
          event.fingerprint,
        ),
      );
      for (const r of [...c.plans, ...c.copies, ...c.assets]) r.stale = true;
      c.opportunity = null;
      c.title = event.data.headline_working;
      this.block(
        s,
        c,
        "source_facts_changed",
        "Hechos modificados: requiere replanificación, nuevo copy y QA",
        "polo-news-researcher",
      );
    }
  }
  private async ingest(
    s: Store,
    discovery: DiscoveredEvent,
    verifiedImport = false,
  ): Promise<EventRecord> {
    ensure(discovery.logicalKey.trim(), "Canonical event key required");
    ensure(
      !["__proto__", "constructor", "prototype"].includes(discovery.logicalKey),
      "Reserved event key",
    );
    const existing = Object.values(s.events).find(
      (e) =>
        e.logicalKey === discovery.logicalKey ||
        e.id === discovery.candidate.event_id ||
        e.sourceKeys.some((k) =>
          discovery.candidate.sources.some(
            (src) => normalizedUrl(src.url) === k,
          ),
        ),
    );
    const sameMaterial =
      existing?.fingerprint === hash(materialEvent(discovery.candidate));
    const incomingSources = discovery.candidate.sources.map((src) =>
      normalizedUrl(src.url),
    );
    if (
      sameMaterial &&
      existing &&
      incomingSources.every((k) => existing.sourceKeys.includes(k))
    ) {
      s.audit.push({
        id: id("audit"),
        contentId: null,
        kind: "event_dedupe_hit",
        at: now(),
        detail: {
          eventId: existing.id,
          reason:
            "logical key / event ID / URL and unchanged factual fingerprint",
        },
      });
      return existing;
    }
    const output =
      verifiedImport || sameMaterial
        ? this.runner.validator.validate(
            "polo-news-researcher",
            discovery.candidate,
          )
        : await this.runner.run(s, "polo-news-researcher", {
            candidate: discovery.candidate,
            context: this.context(s),
            reason:
              "New or changed unverified event could change production eligibility",
          });
    const sourceKeys = output.sources.map((x) => normalizedUrl(x.url));
    const event =
      s.events[discovery.logicalKey] ??
      Object.values(s.events).find(
        (e) =>
          e.data.event_id === output.event_id ||
          e.sourceKeys.some((k) => sourceKeys.includes(k)),
      );
    if (event) {
      const before = event.fingerprint;
      const sources = [...event.data.sources, ...output.sources].filter(
        (x, i, a) => a.findIndex((v) => v.source_id === x.source_id) === i,
      );
      // Discovery preserves conflicting reports as disputed; only an explicit correction can replace facts.
      const claims = [...event.data.claims];
      for (const claim of output.claims) {
        const same = claims.find((c) => c.claim === claim.claim);
        if (same) {
          same.source_ids = [
            ...new Set([...same.source_ids, ...claim.source_ids]),
          ];
        } else claims.push({ ...claim, status: "disputed", confidence: "low" });
      }
      event.data = { ...event.data, claims, sources };
      event.sourceKeys = [...new Set([...event.sourceKeys, ...sourceKeys])];
      event.fingerprint = hash(materialEvent(event.data));
      if (before !== event.fingerprint) {
        event.revision++;
        event.history.push(structuredClone(event.data));
        this.invalidateEventDependents(s, event);
      }
      return event;
    }
    const row: EventRecord = {
      id: output.event_id,
      logicalKey: discovery.logicalKey,
      revision: 1,
      data: output,
      history: [structuredClone(output)],
      sourceKeys,
      fingerprint: hash(materialEvent(output)),
    };
    s.events[row.logicalKey] = row;
    this.createContent(s, row, "single_image");
    return row;
  }
  async runDailyDiscovery(): Promise<EventRecord[]> {
    const candidates = await this.providers.sources.discover();
    return this.tx(async (s) => {
      const result: EventRecord[] = [];
      for (const candidate of candidates)
        result.push(await this.ingest(s, candidate));
      return result;
    });
  }
  importVerifiedEvent(
    event: DiscoveredEvent,
    actor: string,
  ): Promise<EventRecord> {
    return this.tx(async (s) => {
      ensure(
        actor.trim(),
        "Verified import requires identified evidence owner",
      );
      this.runner.validator.validate("polo-news-researcher", event.candidate);
      ensure(
        verified(event.candidate),
        "Import cannot upgrade unverified facts",
      );
      const result = await this.ingest(s, event, true);
      s.audit.push({
        id: id("audit"),
        contentId: null,
        kind: "verified_event_import",
        at: now(),
        detail: { actor, eventId: result.id, evidenceHash: result.fingerprint },
      });
      return result;
    });
  }
  importEditorialPlan(
    plan: SkillOutputs["editorial-strategist"],
    actor: string,
  ): Promise<void> {
    return this.tx(async (s) => {
      ensure(actor.trim(), "Editorial plan import requires actor");
      this.runner.validator.validate("editorial-strategist", plan);
      if (current(s.strategies)?.inputHash === hash(plan)) return;
      s.strategies.push(revision(s.strategies.length + 1, plan, plan));
      s.audit.push({
        id: id("audit"),
        contentId: null,
        kind: "editorial_plan_import",
        at: now(),
        detail: { actor, planId: plan.plan_id },
      });
    });
  }
  async runBenchmarkResearch(
    question: string,
    ttlHours = this.runner.ai.benchmarkTtlHours,
  ): Promise<SkillOutputs["benchmark-researcher"]> {
    ensure(question.trim(), "Benchmark research requires a concrete question");
    return this.tx(async (s) => {
      const input = {
        context: { question, providerMode: "fixtures" },
        reason:
          "On-demand benchmark question; never part of per-post discovery",
      };
      const plan = this.runner.preview(s, "benchmark-researcher", input),
        key = "benchmark:" + hash(question),
        cached = s.researchCache?.[key];
      const existing = cached
        ? s.benchmarks.find((b) => hash(b) === cached.outputHash)
        : undefined;
      if (
        cached &&
        existing &&
        cached.inputHash === plan.inputHash &&
        Date.parse(cached.expiresAt) > Date.now()
      ) {
        s.audit.push({
          id: id("audit"),
          contentId: null,
          kind: "skill_cache_hit",
          at: now(),
          detail: {
            skill: "benchmark-researcher",
            reason: "Unchanged benchmark question within TTL",
          },
        });
        return existing;
      }
      const output = await this.runner.run(
        s,
        "benchmark-researcher",
        input,
        null,
        true,
      );
      if (!s.benchmarks.some((b) => hash(b) === hash(output)))
        s.benchmarks.push(output);
      (s.researchCache ??= {})[key] = {
        inputHash: plan.inputHash,
        outputHash: hash(output),
        expiresAt: new Date(Date.now() + ttlHours * 3600000).toISOString(),
      };
      return output;
    });
  }
  discoverEvent(event: DiscoveredEvent): Promise<EventRecord> {
    return this.tx((s) => this.ingest(s, event));
  }
  async runOpportunityPipeline(
    eventId: string,
    format: ContentItem["type"] = "single_image",
    assets?: Asset[],
  ): Promise<ContentItem> {
    return this.tx(async (s) => {
      const event = Object.values(s.events).find((e) => e.id === eventId);
      ensure(event, "Event not found");
      const c = this.createContent(s, event, format);
      if (!verified(event.data))
        return this.block(
          s,
          c,
          "blocked_verification",
          "Central claim unresolved",
        );
      const sourceAssets =
        assets ??
        current(c.assets)?.data.filter((a) => a.stage !== "rendered") ??
        (await this.providers.assets.findForEvent(event.id, format));
      const opportunityInput = {
        event: event.data,
        format,
        assets: sourceAssets,
        context: this.context(s, c.id),
        reason: "Opportunity can change produce/hold/format/timing decisions",
      };
      const expectedOpportunity = this.runner.preview(
        s,
        "content-opportunity-detector",
        opportunityInput,
        c.id,
      ).inputHash;
      if (
        c.opportunity &&
        !c.blockers.length &&
        c.dependencies?.opportunity === expectedOpportunity
      ) {
        s.audit.push({
          id: id("audit"),
          contentId: c.id,
          kind: "skill_cache_hit",
          at: now(),
          detail: {
            skill: "content-opportunity-detector",
            inputHash: expectedOpportunity,
            reason: "Current opportunity dependencies unchanged",
          },
        });
        return c;
      }
      if (c.opportunity && !c.blockers.length) {
        invalidate(s, c, "opportunity_dependencies_changed");
        for (const r of [...c.plans, ...c.copies]) r.stale = true;
        transition(s, c, "blocked");
      }

      ensure(
        c.reroutes <= this.config.maxReroutes,
        "Reroute budget exhausted; human intervention required",
      );
      if (c.status === "blocked") transition(s, c, "verified");
      const opportunity = await this.runner.run(
        s,
        "content-opportunity-detector",
        opportunityInput,
        c.id,
      );
      (c.dependencies ??= {}).opportunity = expectedOpportunity;
      ensure(
        opportunity.source_candidates.some((x) => x.source_id === event.id),
        "Opportunity references another event",
      );
      c.opportunity = opportunity;
      c.objective = opportunity.strategy.primary_objective;
      c.audienceJob = opportunity.strategy.audience_job;
      c.priority = opportunity.decision.priority;
      c.opportunityScore = opportunity.decision.opportunity_score;
      transition(s, c, "opportunity_created");
      if (
        !["produce_now", "produce_scheduled", "story_only"].includes(
          opportunity.decision.state,
        ) ||
        !opportunity.eligibility.eligible ||
        opportunity.eligibility.blockers.length
      )
        return this.block(
          s,
          c,
          opportunity.decision.state,
          opportunity.decision.reason ?? "No aprobado para producción",
        );
      ensure(
        opportunity.format.preferred === format,
        "Opportunity format differs; replan using its selected format",
        "content-opportunity-detector",
      );
      c.versions.asset++;
      c.assets.push(revision(c.versions.asset, sourceAssets, sourceAssets));
      c.blockers = [];
      transition(s, c, "approved_for_production");
      return c;
    });
  }
  async runContentProduction(
    contentOrOpportunityId: string,
  ): Promise<ContentItem> {
    return this.tx(async (s) => {
      const c =
        s.contents[contentOrOpportunityId] ??
        Object.values(s.contents).find(
          (c) => c.opportunity?.opportunity_id === contentOrOpportunityId,
        );
      ensure(c, "Content/opportunity not found");
      ensure(
        c.opportunity,
        "Missing opportunity; run opportunity pipeline first",
      );
      const event = Object.values(s.events).find((e) => e.id === c.eventId)!;
      ensure(verified(event.data), "blocked_verification");
      const sources =
        current(c.assets)?.data.filter((a) => a.stage !== "rendered") ?? [];
      const input = {
        event: event.data,
        opportunity: c.opportunity,
        assets: sources,
        format: c.type,
        context: this.context(s, c.id),
      };
      const expectedPlan = this.runner.preview(
        s,
        c.type === "reel" ? "reel-planner" : "social-designer",
        input,
        c.id,
      ).inputHash;
      const expectedCopy = this.runner.preview(
        s,
        "copywriter",
        { ...input, content: c },
        c.id,
      ).inputHash;
      const planCurrent =
        c.dependencies?.plan === expectedPlan &&
        !current(c.plans)?.stale &&
        !!current(c.plans);
      const copyCurrent =
        c.dependencies?.copy === expectedCopy &&
        !current(c.copies)?.stale &&
        !!current(c.copies);
      if (
        !["qa_failed", "human_rejected", "planning"].includes(c.status) &&
        planCurrent &&
        copyCurrent
      ) {
        for (const skill of [
          c.type === "reel" ? "reel-planner" : "social-designer",
          "copywriter",
        ])
          s.audit.push({
            id: id("audit"),
            contentId: c.id,
            kind: "skill_cache_hit",
            at: now(),
            detail: {
              skill,
              reason: "Current production dependencies unchanged",
            },
          });
        return c;
      }
      ensure(
        [
          "approved_for_production",
          "planning",
          "qa_failed",
          "human_rejected",
          "awaiting_assets",
          "blocked",
          "ready_for_qa",
          "ready_for_human_approval",
          "human_approved",
          "ready_to_publish",
        ].includes(c.status),
        "Content not eligible for production",
      );
      ensure(
        !c.blockers.length ||
          c.blockers.every(
            (b) =>
              b.owner === "copywriter" ||
              b.owner === "social-designer" ||
              b.owner === "reel-planner",
          ),
        "Resolve upstream blocker before production",
      );
      ensure(c.reroutes <= this.config.maxReroutes, "Reroute budget exhausted");
      if (!sources.length)
        return this.block(s, c, "blocked_assets", "No hay assets disponibles");
      try {
        assertRights(c);
      } catch (e) {
        return this.block(
          s,
          c,
          "blocked_rights",
          e instanceof Error ? e.message : String(e),
        );
      }
      invalidate(s, c, "new_production");
      transition(s, c, "planning");
      let plan = current(c.plans)?.data;
      if (!planCurrent || !plan) {
        plan = await this.makePlan(s, c, input);
        if (
          "state" in plan &&
          !["ready_for_render", "ready_for_edit"].includes(plan.state)
        )
          return this.block(
            s,
            c,
            plan.state,
            "Plan requiere resolver dependencias",
          );
        ensure(
          plan.opportunity_id === c.opportunity.opportunity_id,
          "Plan opportunity mismatch",
        );
        const referenced = isReelPlan(plan)
          ? plan.footage
              .filter((f) => f.selection_status !== "avoid")
              .map((f) => f.source_id)
          : plan.assets.map((a) => a.asset_id);
        if (
          referenced.some((assetId) => !sources.some((a) => a.id === assetId))
        )
          return this.block(
            s,
            c,
            "blocked_assets",
            "El plan referencia assets ausentes del inventario autorizado",
          );
        transition(s, c, "in_production");
        const rendered = isReelPlan(plan)
          ? await this.providers.video.getRender(
              (await this.providers.video.requestCut(plan, sources)).jobId,
            )
          : await this.providers.design.render(plan, sources, {
              event: event.data,
              eventVersion: event.revision,
              recentFamilies: Object.values(s.contents)
                .filter((item) => item.id !== c.id)
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .flatMap(
                  (item) =>
                    current(item.assets)
                      ?.data.filter((a) => a.stage === "rendered")
                      .map((a) => String(a.metadata.compositionFamily ?? "")) ??
                    [],
                )
                .filter(Boolean)
                .slice(-4),
            });
        if (!rendered.length)
          return this.block(
            s,
            c,
            "blocked_assets",
            "Renderer returned no assets",
          );
        c.versions.asset++;
        c.plans.push(revision(c.plans.length + 1, plan, input));
        c.assets.push(
          revision(c.versions.asset, [...sources, ...rendered], plan),
        );
        (c.dependencies ??= {}).plan = expectedPlan;
      } else transition(s, c, "in_production");
      const copy = await this.runner.run(
        s,
        "copywriter",
        { ...input, content: c },
        c.id,
      );
      if (!["ready_for_approval", "ready_for_publish"].includes(copy.state))
        return this.block(s, c, copy.state, "Copy blocked");
      ensure(
        copy.opportunity_id === c.opportunity.opportunity_id,
        "Copy opportunity mismatch",
      );
      ensure(
        copy.source_facts.length > 0 &&
          copy.source_facts.every((f) =>
            event.data.claims.some(
              (claim) =>
                claim.claim === f.fact &&
                claim.status === f.verification_status,
            ),
          ),
        "Copy contains an unsupported factual ledger",
        "copywriter",
      );
      c.versions.copy++;
      (c.dependencies ??= {}).copy = this.runner.preview(
        s,
        "copywriter",
        { ...input, content: c },
        c.id,
      ).inputHash;
      c.copies.push(revision(c.versions.copy, copy, { input, plan }));
      c.blockers = [];
      transition(s, c, "ready_for_qa");
      return c;
    });
  }
  private async makePlan(
    s: Store,
    c: ContentItem,
    input: Parameters<SkillRunner["run"]>[2],
  ): Promise<SkillOutputs["reel-planner"] | SkillOutputs["social-designer"]> {
    return c.type === "reel"
      ? this.runner.run(s, "reel-planner", input, c.id)
      : this.runner.run(s, "social-designer", input, c.id);
  }
  async runQualityReview(contentId: string): Promise<ContentItem> {
    return this.tx(async (s) => {
      const c = this.item(s, contentId);
      try {
        finalRenderInputs(current(c.assets)?.data ?? []);
      } catch (error) {
        return this.block(
          s,
          c,
          "render_integrity",
          error instanceof Error ? error.message : "Final render changed",
          "renderer_editor",
        );
      }
      const qaInput = {
          ...previewInput(s, c, "quality-reviewer", this.runner),
          context: this.context(s, c.id),
        },
        expectedReview = this.runner.preview(
          s,
          "quality-reviewer",
          qaInput,
          c.id,
        ).inputHash;
      const last = current(c.reviews);
      if (
        c.dependencies?.review === expectedReview &&
        last &&
        (!last.stale || last.data.decision !== "pass_for_human_approval") &&
        !current(c.copies)?.stale &&
        !current(c.plans)?.stale
      ) {
        s.audit.push({
          id: id("audit"),
          contentId: c.id,
          kind: "skill_cache_hit",
          at: now(),
          detail: {
            skill: "quality-reviewer",
            reason: "Exact same package, judgment policy and model",
          },
        });
        return c;
      }
      if (c.status === "ready_for_human_approval") {
        invalidate(s, c, "qa_dependencies_changed");
        transition(s, c, "qa_failed");
      }
      ensure(
        ["ready_for_qa", "qa_failed"].includes(c.status),
        "Content is not ready for QA",
      );
      try {
        assertRights(c);
      } catch (e) {
        return this.block(s, c, "blocked_rights", String(e));
      }
      const event = Object.values(s.events).find((e) => e.id === c.eventId)!;
      const gate = new DeterministicQualityGate(this.runner.validator).inspect(
        s,
        c,
        event.data,
      );
      s.audit.push({
        id: id("audit"),
        contentId: c.id,
        kind: "deterministic_quality_gate",
        at: now(),
        detail: gate,
      });
      if (!gate.passed) {
        invalidate(s, c, "deterministic_qa_failed");
        c.blockers = gate.issues.map((i) => ({
          code: i.code,
          owner: i.owner,
          detail: i.detail,
          at: now(),
        }));
        c.reroutes++;
        transition(s, c, "qa_failed", { issues: c.blockers });
        return c;
      }
      if (c.status === "qa_failed") transition(s, c, "ready_for_qa");
      const result = await this.review(s, c, "post_render");
      if (result.decision !== "pass_for_human_approval")
        return this.qaFailure(s, c, result);
      if (
        this.runner.isLive &&
        current(c.assets)?.data.some((a) => a.metadata.actualMedia === false)
      )
        return this.block(
          s,
          c,
          "blocked_assets",
          "Live editorial review cannot certify mock render pixels; provide final media for visual QA",
        );
      c.versions.review = current(c.reviews)!.version;
      assertReadyForApproval(c);
      transition(s, c, "ready_for_human_approval");
      pendingApproval(c);
      return c;
    });
  }
  private async review(
    s: Store,
    c: ContentItem,
    stage: "post_render" | "pre_publish",
  ): Promise<SkillOutputs["quality-reviewer"]> {
    const event = Object.values(s.events).find((e) => e.id === c.eventId)!;
    const input = {
      event: event.data,
      content: c,
      stage,
      format: c.type,
      context: this.context(s, c.id),
      deterministicGate: new DeterministicQualityGate(
        this.runner.validator,
      ).inspect(s, c, event.data, stage),
      reason:
        "Deterministic checks passed; independent editorial judgment is still required",
    };
    const review = await this.runner.run(s, "quality-reviewer", input, c.id);
    (c.dependencies ??= {}).review = this.runner.preview(
      s,
      "quality-reviewer",
      input,
      c.id,
    ).inputHash;
    ensure(review.content_id === c.id, "QA content mismatch");
    ensure(
      review.versions.asset_version === String(c.versions.asset) &&
        review.versions.copy_version === String(c.versions.copy) &&
        review.versions.metadata_version === String(c.versions.metadata),
      "QA version mismatch",
    );
    if (
      ["pass_for_human_approval", "pass_for_publish"].includes(review.decision)
    )
      ensure(
        event.data.claims.every((claim) =>
          review.source_of_truth.some(
            (f) => f.fact === claim.claim && f.status === claim.status,
          ),
        ),
        "QA source of truth is incomplete",
      );
    c.reviews.push(revision(c.reviews.length + 1, review, input));
    return review;
  }
  private qaFailure(
    s: Store,
    c: ContentItem,
    review: SkillOutputs["quality-reviewer"],
  ): ContentItem {
    invalidate(s, c, review.decision);
    c.reroutes++;
    c.blockers = review.issues
      .filter(
        (i) =>
          ["open", "fixed_pending_recheck"].includes(i.status) &&
          ["blocker", "major"].includes(i.severity),
      )
      .map((i) => ({
        code: i.category,
        owner: i.owner,
        detail: i.required_fix,
        at: now(),
      }));
    if (!c.blockers.length)
      c.blockers = [
        {
          code: review.decision,
          owner: ownerFor(review.decision, c.type),
          detail: "Resolver decisión QA y ejecutar re-review",
          at: now(),
        },
      ];
    if (c.reroutes > this.config.maxReroutes)
      c.blockers = [
        {
          code: "reroute_budget_exhausted",
          owner: "human-editor",
          detail: "Revisión humana requerida",
          at: now(),
        },
      ];
    transition(s, c, "qa_failed", { issues: c.blockers });
    return c;
  }
  approveContent(
    contentId: string,
    actor: string,
    expectedHash: string,
    comment?: string,
  ): Promise<ContentItem> {
    return this.tx(async (s) => {
      const c = this.item(s, contentId);
      assertReadyForApproval(c);
      approve(s, c, actor, expectedHash, comment);
      return c;
    });
  }
  rejectContent(
    contentId: string,
    actor: string,
    expectedHash: string,
    comment: string,
    changesRequested = false,
  ): Promise<ContentItem> {
    return this.tx(async (s) => {
      const c = this.item(s, contentId);
      ensure(actor.trim(), "Human identity required");
      ensure(
        c.status === "ready_for_human_approval" &&
          expectedHash === packageHash(c),
        "Stale rejection",
      );
      const a = c.approvals.at(-1)!;
      a.state = changesRequested ? "changes_requested" : "rejected";
      a.approver = actor;
      a.at = now();
      a.comment = comment;
      transition(s, c, "human_rejected", { actor, comment });
      return c;
    });
  }
  async reviseContent(
    contentId: string,
    change: {
      copy?: SkillOutputs["copywriter"];
      assets?: Asset[];
      metadata?: Record<string, unknown>;
    },
    actor: string,
  ): Promise<ContentItem> {
    return this.tx(async (s) => {
      const c = this.item(s, contentId);
      ensure(c.status !== "archived", "Archived content is immutable");
      ensure(actor.trim(), "Editor identity required");
      const material =
        (change.copy && hash(change.copy) !== hash(current(c.copies)?.data)) ||
        (change.assets &&
          hash(change.assets) !== hash(current(c.assets)?.data)) ||
        (change.metadata &&
          hash(change.metadata) !== hash(current(c.metadata)?.data));
      if (!material) return c;
      if (change.copy) {
        this.runner.validator.validate("copywriter", change.copy);
        ensure(
          change.copy.opportunity_id === c.opportunity?.opportunity_id,
          "Copy opportunity mismatch",
        );
      }
      const oldOutputs = current(c.copies)?.data.outputs;
      const visualCopyChanged =
        change.copy &&
        hash({
          headline: change.copy.outputs.headline,
          subheadline: change.copy.outputs.subheadline,
          overlays: change.copy.outputs.overlays,
          slides: change.copy.outputs.slide_copy,
          stories: change.copy.outputs.story_frames,
        }) !==
          hash({
            headline: oldOutputs?.headline,
            subheadline: oldOutputs?.subheadline,
            overlays: oldOutputs?.overlays,
            slides: oldOutputs?.slide_copy,
            stories: oldOutputs?.story_frames,
          });
      invalidate(s, c, `material_edit by ${actor}`);
      if (change.copy) {
        if (c.dependencies) c.dependencies.copy = undefined;
        c.versions.copy++;
        c.copies.push(revision(c.versions.copy, change.copy, change));
      }
      if (change.assets) {
        c.versions.asset++;
        c.assets.push(revision(c.versions.asset, change.assets, change));
        for (const p of c.plans) p.stale = true;
        for (const cp of c.copies) cp.stale = true;
      }
      if (change.metadata) {
        c.versions.metadata++;
        c.metadata.push(revision(c.versions.metadata, change.metadata, change));
        for (const p of c.plans) p.stale = true;
        for (const cp of c.copies) cp.stale = true;
      }
      if (visualCopyChanged) for (const p of c.plans) p.stale = true;
      transition(s, c, "planning", { actor, reason: "reapproval_required" });
      if (!change.assets && !change.metadata && !visualCopyChanged)
        transition(s, c, "in_production");
      if (!change.assets && !change.metadata && !visualCopyChanged)
        transition(s, c, "ready_for_qa");
      return c;
    });
  }
  async correctEvent(
    eventId: string,
    candidate: SkillOutputs["polo-news-researcher"],
    actor: string,
  ): Promise<EventRecord> {
    return this.tx(async (s) => {
      ensure(actor.trim(), "Correction requires editor identity");
      const event = Object.values(s.events).find((e) => e.id === eventId);
      ensure(event, "Unknown event");
      const output = await this.runner.run(
        s,
        "polo-news-researcher",
        { candidate, context: { correction: true, actor } },
        null,
        true,
      );
      ensure(output.event_id === eventId, "Correction event ID mismatch");
      if (hash(materialEvent(output)) === event.fingerprint) return event;
      event.data = output;
      event.revision++;
      event.fingerprint = hash(materialEvent(output));
      event.history.push(structuredClone(output));
      event.sourceKeys = [
        ...new Set([
          ...event.sourceKeys,
          ...output.sources.map((x) => normalizedUrl(x.url)),
        ]),
      ];
      this.invalidateEventDependents(s, event);
      return event;
    });
  }
  async simulatePublish(
    contentId: string,
    scheduledAt?: string,
  ): Promise<Publication | ContentItem> {
    return this.tx(async (s) => {
      const c = this.item(s, contentId);
      const digest = packageHash(c);
      const key = hash({ contentId, packageHash: digest });
      const previous = c.publications.find(
        (p) =>
          p.idempotencyKey === key &&
          ["published", "scheduled"].includes(p.status),
      );
      if (previous) return previous;
      const payload = publishPackage(c);
      const event = Object.values(s.events).find((e) => e.id === c.eventId)!;
      const gate = new DeterministicQualityGate(this.runner.validator).inspect(
        s,
        c,
        event.data,
        "pre_publish",
      );
      ensure(gate.passed, "Deterministic prepublication checks failed");
      const prior = current(c.reviews)!.data;
      const review: SkillOutputs["quality-reviewer"] = {
        ...structuredClone(prior),
        review_id: id("review"),
        review_stage: "pre_publish",
        review_mode: "full",
        decision: "pass_for_publish",
        approval: {
          state: "approved",
          approver: c.approvals.at(-1)!.approver,
          approved_at: c.approvals.at(-1)!.at,
        },
        review_origin: "deterministic_preflight_of_exact_approved_package",
      };
      this.runner.validator.validate("quality-reviewer", review);
      c.reviews.push(
        revision(c.reviews.length + 1, review, { gate, approvedHash: digest }),
      );
      s.audit.push({
        id: id("audit"),
        contentId: c.id,
        kind: "deterministic_pre_publish",
        at: now(),
        detail: { gate, reviewId: review.review_id, llmCall: false },
      });
      if (review.decision !== "pass_for_publish")
        return this.qaFailure(s, c, review);
      ensure(
        review.review_stage === "pre_publish" && review.review_mode === "full",
        "Incomplete prepublish review",
      );
      ensure(
        Object.values(review.checks).every(
          (check) => check === "pass" || check === "not_applicable",
        ),
        "Prepublish QA has unresolved checks",
      );
      const check = await this.providers.publishing.validate(payload);
      ensure(check.valid, check.issues.join(";"));
      transition(s, c, "ready_to_publish");
      const receipt = scheduledAt
        ? await this.providers.publishing.schedule(payload, scheduledAt, key)
        : await this.providers.publishing.publish(payload, key);
      const p: Publication = {
        id: `publication-${key.slice(0, 24)}`,
        provider: "mock",
        idempotencyKey: key,
        scheduledAt: scheduledAt ?? null,
        publishedAt: scheduledAt ? null : receipt.at,
        externalId: receipt.externalId,
        status: receipt.status,
        versions: { ...c.versions },
        packageHash: digest,
        payload,
      };
      c.publications.push(p);
      s.audit.push({
        id: id("audit"),
        contentId,
        kind: "mock_publication",
        at: now(),
        detail: p,
      });
      if (!scheduledAt) transition(s, c, "published");
      return p;
    });
  }
  async runPerformanceAnalysis(
    contentId: string,
    window = "72h",
  ): Promise<ContentItem> {
    return this.tx(async (s) => {
      const c = this.item(s, contentId);
      const publication = c.publications.findLast(
        (p) => p.status === "published",
      );
      ensure(publication, "No published version");
      ensure(
        ["published", "measuring", "analyzed"].includes(c.status),
        "Content cannot be measured in this state",
      );
      const snapshot = await this.providers.analytics.snapshot(
        publication,
        window,
      );
      if (!snapshot.simulated) {
        const hours =
          window === "24h"
            ? 24
            : window === "72h"
              ? 72
              : window === "early"
                ? 1
                : window === "weekly"
                  ? 168
                  : window === "monthly"
                    ? 720
                    : null;
        const enoughMetrics = snapshot.metrics.some(
          (m) =>
            m.availability_status === "available" &&
            typeof m.value === "number",
        );
        if (
          hours === null ||
          Date.now() - Date.parse(publication.publishedAt!) < hours * 3600000 ||
          !enoughMetrics
        ) {
          s.audit.push({
            id: id("audit"),
            contentId,
            kind: "performance_analysis_deferred",
            at: now(),
            detail: {
              window,
              reason:
                "Observation window or metric completeness insufficient; no analyst call",
            },
          });
          return c;
        }
      }
      if (
        c.snapshots.some((p) => p.id === snapshot.id) &&
        s.learnings.some((l) => l.evidence.includes(snapshot.id))
      )
        return c;
      transition(s, c, "measuring");
      c.snapshots.push(snapshot);
      const analysis = await this.runner.run(
        s,
        "performance-analyst",
        { snapshot, content: c, context: this.context(s) },
        c.id,
      );
      ensure(
        analysis.scope.content_ids.includes(contentId),
        "Analysis content mismatch",
      );
      for (const l of analysis.learnings) {
        if (
          !s.learnings.some(
            (x) => x.contentId === contentId && x.learning_id === l.learning_id,
          )
        )
          s.learnings.push({
            ...l,
            contentId,
            evidence: [
              snapshot.id,
              publication.id,
              ...analysis.results.flatMap((r) => r.evidence_ids),
            ],
            simulated: true,
            at: now(),
          });
      }
      transition(s, c, "analyzed");
      return c;
    });
  }
  async runWeeklyStrategyReview(): Promise<
    SkillOutputs["editorial-strategist"]
  > {
    return this.tx(async (s) => {
      const evidence = {
        learningIds: s.learnings.map((l) => [
          l.learning_id,
          l.statement,
          l.maturity,
          l.confidence,
        ]),
        benchmarks: s.benchmarks.map(hash),
        calendar: await this.providers.data.getCalendar(),
      };
      const fingerprint = this.runner.preview(s, "editorial-strategist", {
        context: evidence,
      }).inputHash;
      const cached = s.researchCache?.strategy;
      if (
        cached &&
        current(s.strategies) &&
        cached.inputHash === fingerprint &&
        Date.parse(cached.expiresAt) > Date.now()
      ) {
        s.audit.push({
          id: id("audit"),
          contentId: null,
          kind: "skill_cache_hit",
          at: now(),
          detail: {
            skill: "editorial-strategist",
            reason:
              "Persisted strategy with unchanged evidence inside review window",
          },
        });
        return current(s.strategies)!.data;
      }
      const context = {
        ...(this.context(s) as object),
        calendar: evidence.calendar,
      };
      const output = await this.runner.run(
        s,
        "editorial-strategist",
        {
          context,
          reason:
            "Explicit periodic strategy review or changed performance evidence",
        },
        null,
        true,
      );
      s.strategies.push(revision(s.strategies.length + 1, output, context));
      (s.researchCache ??= {}).strategy = {
        inputHash: fingerprint,
        outputHash: hash(output),
        expiresAt: new Date(
          Date.now() + this.runner.ai.strategyTtlHours * 3600000,
        ).toISOString(),
      };
      return output;
    });
  }
  async resumeBudget(
    contentId: string,
    actor: string,
    reason: string,
  ): Promise<ContentItem> {
    return this.tx(async (s) => {
      const c = this.item(s, contentId);
      ensure(
        actor.trim() && reason.trim(),
        "Budget review requires actor and reason",
      );
      ensure(
        c.blockers.some((b) => b.code === "blocked_budget"),
        "Content has no budget blocker",
      );
      c.blockers = [];
      transition(
        s,
        c,
        !c.opportunity
          ? "verified"
          : current(c.copies) &&
              !current(c.copies)?.stale &&
              current(c.plans) &&
              !current(c.plans)?.stale
            ? "ready_for_qa"
            : "planning",
      );
      s.audit.push({
        id: id("audit"),
        contentId,
        kind: "human_budget_review",
        at: now(),
        detail: {
          actor,
          reason,
          limits: this.runner.ai.classes[c.workflowClass ?? "STANDARD"],
        },
      });
      return c;
    });
  }
  async inspect(contentId?: string): Promise<unknown> {
    const s = await this.repository.read();
    if (!contentId) return s;
    const c = this.item(s, contentId);
    return {
      content: c,
      packageHash: packageHash(c),
      event: Object.values(s.events).find((e) => e.id === c.eventId),
      runs: s.runs.filter((r) => r.contentId === contentId),
      audit: s.audit.filter((a) => a.contentId === contentId),
      learnings: s.learnings.filter((l) => l.contentId === contentId),
    };
  }
}
