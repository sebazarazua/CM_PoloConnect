import { CMError, ensure, hash, id, now, redact } from "../common/core.js";
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
  ) {
    ensure(
      providers.publishing.name === "mock",
      "This phase only accepts MockPublishingProvider",
    );
    this.runner = new SkillRunner(new SkillRegistry(), executor, config);
  }
  private tx<T>(work: (store: Store) => Promise<T>): Promise<T> {
    return this.repository.transaction(async (s) => {
      try {
        return await work(s);
      } catch (e) {
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
      brandStatus: "brand_system_required",
      strategy: current(s.strategies)?.data ?? null,
      benchmarks: s.benchmarks,
      learnings: s.learnings,
      recent: Object.values(s.contents)
        .filter((c) => c.id !== excludeId)
        .map((c) => ({
          id: c.id,
          eventId: c.eventId,
          type: c.type,
          status: c.status,
          objective: c.objective,
        })),
      providerMode: "mock",
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
            simulated: true,
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
  ): Promise<EventRecord> {
    ensure(discovery.logicalKey.trim(), "Canonical event key required");
    ensure(
      !["__proto__", "constructor", "prototype"].includes(discovery.logicalKey),
      "Reserved event key",
    );
    const output = await this.runner.run(s, "polo-news-researcher", {
      candidate: discovery.candidate,
      context: this.context(s),
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
      if (!s.strategies.length) {
        const plan = await this.runner.run(s, "editorial-strategist", {
          context: {
            editorial,
            learnings: s.learnings,
            calendar: await this.providers.data.getCalendar(),
          },
        });
        s.strategies.push(revision(1, plan, editorial));
      }
      const benchmark = await this.runner.run(s, "benchmark-researcher", {
        context: { mode: "fixtures", question: "Claridad de resultados" },
      });
      if (!s.benchmarks.some((b) => hash(b) === hash(benchmark)))
        s.benchmarks.push(benchmark);
      const result: EventRecord[] = [];
      for (const c of candidates) result.push(await this.ingest(s, c));
      return result;
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
      if (c.opportunity && !c.blockers.length) return c;
      ensure(
        c.reroutes <= this.config.maxReroutes,
        "Reroute budget exhausted; human intervention required",
      );
      if (c.status === "blocked") transition(s, c, "verified");
      const sourceAssets =
        assets ?? (await this.providers.assets.findForEvent(event.id, format));
      const opportunity = await this.runner.run(
        s,
        "content-opportunity-detector",
        {
          event: event.data,
          format,
          assets: sourceAssets,
          context: this.context(s),
        },
        c.id,
      );
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
      const inputHash = hash(input);
      if (
        !["qa_failed", "human_rejected", "planning"].includes(c.status) &&
        current(c.plans)?.inputHash === inputHash &&
        !current(c.plans)?.stale &&
        !current(c.copies)?.stale &&
        current(c.copies)
      )
        return c;
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
      const plan = await this.makePlan(s, c, input);
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
      if (referenced.some((assetId) => !sources.some((a) => a.id === assetId)))
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
        : await this.providers.design.render(plan, sources);
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
      if (c.status === "ready_for_human_approval" && !current(c.reviews)?.stale)
        return c;
      ensure(
        ["ready_for_qa", "qa_failed"].includes(c.status),
        "Content is not ready for QA",
      );
      try {
        assertRights(c);
      } catch (e) {
        return this.block(s, c, "blocked_rights", String(e));
      }
      const result = await this.review(s, c, "post_render");
      if (result.decision !== "pass_for_human_approval")
        return this.qaFailure(s, c, result);
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
      context: this.context(s),
    };
    const review = await this.runner.run(s, "quality-reviewer", input, c.id);
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
      const review = await this.review(s, c, "pre_publish");
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
      const context = {
        editorial,
        learnings: s.learnings,
        benchmarks: s.benchmarks,
        calendar: await this.providers.data.getCalendar(),
        analysis: s.runs
          .filter(
            (r) => r.skill === "performance-analyst" && r.status === "success",
          )
          .map((r) => r.output),
      };
      const inputHash = hash(context);
      const last = current(s.strategies);
      if (last?.inputHash === inputHash) return last.data;
      const plan = await this.runner.run(s, "editorial-strategist", {
        context: { ...context, previous: current(s.strategies)?.data ?? null },
      });
      s.strategies.push(revision(s.strategies.length + 1, plan, context));
      return plan;
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
