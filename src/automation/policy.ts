import { current, type ContentItem, type Store } from "../domain/models.js";
import { assertReadyForApproval, assertRights } from "../domain/guards.js";
import { packageHash, validApproval } from "../approvals/service.js";
import { fileDigest } from "../render/brand.js";
import { localPath, truthFromEvent } from "../render/spec.js";
import { finalRenderInputs } from "../render/visual-input.js";
import { hash } from "../common/core.js";
import { candidateKey } from "./sources.js";
import { DeterministicQualityGate } from "../qa/deterministic-gate.js";
import { OutputValidator, SkillRegistry } from "../skills/runtime.js";
let gate: DeterministicQualityGate | undefined;
import type { AutomationConfig } from "./config.js";
import { policyConfigHash } from "./config.js";
import type {
  ContentCandidate,
  PolicyDecision,
  PolicyVerdict,
} from "./types.js";
export function inEditorialWindow(
  date: Date,
  config: AutomationConfig,
): boolean {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: config.timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.weekday!,
  );
  const clock = `${parts.hour}:${parts.minute}`;
  return config.windows.some((w) =>
    w.start < w.end
      ? w.days.includes(day) && clock >= w.start && clock < w.end
      : (w.days.includes(day) && clock >= w.start) ||
        (w.days.includes((day + 6) % 7) && clock < w.end),
  );
}
export function cycleSpending(store: Store, since: string) {
  const runs = store.runs.filter(
    (r) => r.llmCall && Date.parse(r.startedAt) >= Date.parse(since),
  );
  return {
    calls: runs.length,
    costUsd: runs.reduce(
      (n, r) => n + (r.budgetCharge?.costUsd ?? r.usage?.costUsd ?? 0),
      0,
    ),
    unknown: runs.some(
      (r) => r.budgetCharge?.costUsd == null && r.usage?.costUsd == null,
    ),
  };
}
export function sourceEligibility(
  candidate: ContentCandidate,
  config: AutomationConfig,
): { verdict: "ready" | PolicyVerdict; reason: string[] } {
  const e = candidate.event;
  if (
    e.simulated !== true &&
    e.sources.some((s) => {
      try {
        const u = new URL(s.url);
        return u.protocol !== "https:" || u.hostname.endsWith(".invalid");
      } catch {
        return true;
      }
    })
  )
    return {
      verdict: "needs_human_approval",
      reason: ["real_event_requires_non_placeholder_evidence_urls"],
    };
  if (e.editorial.action_state === "reject")
    return { verdict: "reject", reason: ["source_editorial_reject"] };
  if (
    !e.claims.length ||
    e.claims.some(
      (c) =>
        !["confirmed_primary", "confirmed_multi_source"].includes(c.status) ||
        !c.source_ids.length ||
        c.source_ids.some((id) => !e.sources.some((s) => s.source_id === id)),
    )
  )
    return {
      verdict: "needs_human_approval",
      reason: ["unverified_or_ambiguous_facts"],
    };
  if (
    !["owned", "licensed", "permission_confirmed"].includes(
      e.rights.media_status,
    ) ||
    candidate.assets.some(
      (a) => !["owned", "licensed", "permission_confirmed"].includes(a.rights),
    )
  )
    return { verdict: "needs_human_approval", reason: ["unclear_rights"] };
  if (
    !config.allowedEventTypes.includes(e.event_type) ||
    e.event_type !== "match_result"
  )
    return {
      verdict: "needs_human_approval",
      reason: ["event_type_requires_human_review_or_renderer_adapter"],
    };
  try {
    truthFromEvent(e);
  } catch {
    return {
      verdict: "needs_human_approval",
      reason: ["structured_render_facts_missing_or_conflicting"],
    };
  }
  return { verdict: "ready", reason: [] };
}
export class AutomaticPublishingPolicy {
  readonly version = "1" as const;
  evaluate(
    store: Store,
    item: ContentItem,
    candidate: ContentCandidate,
    config: AutomationConfig,
    clock = new Date(),
    cycleId?: string,
  ): PolicyDecision {
    const result = (
      verdict: PolicyVerdict,
      ...reason: string[]
    ): PolicyDecision => {
      const body = {
        version: this.version,
        contentId: item.id,
        accountId: config.accountId,
        packageHash: packageHash(item),
        versions: { ...item.versions },
        verdict,
        reason,
        evaluatedAt: clock.toISOString(),
        configHash: policyConfigHash(config),
      };
      return { ...body, id: hash({ ...body, evaluatedAt: undefined }) };
    };
    const source = sourceEligibility(candidate, config);
    if (item.status === "human_rejected" || item.status === "archived")
      return result("reject", "human_rejected_or_archived");
    if (
      store.automation?.candidates[candidateKey(candidate)]?.reason?.includes(
        "input_removed_from_queue",
      )
    )
      return result("reject", "input_removed_from_queue");
    if (source.verdict !== "ready")
      return result(source.verdict, ...source.reason);
    if (!/^\d+$/.test(config.accountId))
      return result("hold", "target_account_not_configured");
    const target = current(item.metadata)?.data.instagramTarget as
      { accountId?: string; surface?: string } | undefined;
    if (target?.accountId !== config.accountId || target.surface !== "feed")
      return result("hold", "wrong_account_or_surface");
    if (
      current(item.metadata)?.data.automationCandidateKey !==
      candidateKey(candidate)
    )
      return result("hold", "automation_input_or_consent_changed");
    if (candidate.event.simulated === true && !config.allowFictitious)
      return result(
        "needs_human_approval",
        "fictitious_content_not_authorized_for_automation",
      );
    try {
      assertReadyForApproval(item);
      assertRights(item);
      const renders = finalRenderInputs(current(item.assets)?.data ?? []);
      if (renders.length !== 1)
        return result("hold", "exactly_one_final_feed_render_required");
      for (const asset of current(item.assets)!.data) {
        if (
          asset.metadata.actualMedia !== true ||
          typeof asset.metadata.sha256 !== "string" ||
          fileDigest(localPath(asset.storageRef)) !== asset.metadata.sha256
        )
          return result("hold", "missing_or_changed_asset");
      }
    } catch {
      return result("hold", "qa_rights_or_current_versions_failed");
    }
    if (
      current(item.metadata)?.data.automationSourceAssetsHash !==
      hash(current(item.assets)?.data.filter((a) => a.stage !== "rendered"))
    )
      return result("hold", "source_asset_inventory_changed");
    const review = current(item.reviews)!.data;
    const run = store.runs.findLast(
      (r) =>
        r.skill === "quality-reviewer" &&
        r.contentId === item.id &&
        r.status === "success" &&
        r.llmCall &&
        hash(r.output) === hash(review),
    );
    const visuals = (
      run?.input as { visualAssets?: Array<{ sha256: string }> } | undefined
    )?.visualAssets;
    const render = finalRenderInputs(current(item.assets)!.data)[0]!;
    if (
      !run ||
      !run.provider ||
      ["fixture", "fixtures"].includes(run.provider) ||
      review.simulated === true ||
      !visuals?.some((v) => v.sha256 === render.sha256) ||
      review.scope.publishing_route !== "instagram_api_with_instagram_login"
    )
      return result("hold", "real_independent_visual_qa_required");
    const event = Object.values(store.events).find(
      (e) => e.id === item.eventId,
    );
    if (!event || hash(event.data.claims) !== hash(candidate.event.claims))
      return result("hold", "source_ledger_changed");
    gate ??= new DeterministicQualityGate(
      new OutputValidator(new SkillRegistry()),
    );
    if (!gate.inspect(store, item, event.data, "post_render").passed)
      return result("hold", "deterministic_preflight_failed");
    const expiry = item.opportunity?.timing.expires_at;
    if (expiry && Date.parse(expiry) <= clock.getTime())
      return result("reject", "opportunity_expired");
    if (
      item.blockers.length ||
      current(item.copies)?.stale ||
      current(item.plans)?.stale ||
      current(item.metadata)?.stale
    )
      return result("hold", "stale_package_or_blockers");
    const all = Object.values(store.contents)
      .flatMap((c) =>
        c.publications.map((p) => ({ content: c, publication: p })),
      )
      .filter(
        (r) =>
          r.publication.provider === "instagram" &&
          r.publication.instagram?.accountId === config.accountId,
      );
    if (
      all.some(
        (r) =>
          r.content.id === item.id &&
          r.publication.status === "published" &&
          r.publication.packageHash === packageHash(item),
      )
    )
      return result("reject", "already_published");
    if (
      all.some((r) => ["unknown", "publishing"].includes(r.publication.status))
    )
      return result("hold", "uncertain_publication_requires_reconciliation");
    const recent = all.filter(
      (r) =>
        r.publication.status === "published" &&
        r.publication.publishedAt &&
        Date.parse(r.publication.publishedAt) >= clock.getTime() - 86400000,
    );
    if (recent.length >= config.maxPosts24Hours)
      return result("hold", "daily_saturation_limit");
    if (
      recent.some(
        (r) =>
          clock.getTime() - Date.parse(r.publication.publishedAt!) <
          config.minGapMinutes * 60000,
      )
    )
      return result("hold", "recent_post_minimum_gap");
    if (
      candidate.timing.mode !== "publish_now" &&
      Date.parse(candidate.timing.at!) > clock.getTime()
    )
      return result(
        "hold",
        candidate.timing.mode === "scheduled_at"
          ? "scheduled_at_not_due"
          : "hold_until_not_due",
      );
    if (
      !config.bypassWindowEventTypes.includes(candidate.event.event_type) &&
      !inEditorialWindow(clock, config)
    )
      return result("hold", "outside_editorial_window");
    const cycle = cycleId
      ? store.automation?.cycles.find((c) => c.id === cycleId)
      : undefined;
    if (cycle) {
      const spent = cycleSpending(store, cycle.startedAt);
      if (
        spent.unknown ||
        spent.calls > config.maxLlmCallsPerCycle ||
        spent.costUsd > config.maxCostUsdPerCycle
      )
        return result("hold", "cycle_budget_exceeded_or_unknown");
      if (cycle.counters.published >= config.maxPerCycle)
        return result("hold", "per_cycle_publication_limit");
    }
    if (config.mode !== "automatic")
      return result(
        "needs_human_approval",
        `${config.mode}_mode_requires_manual_publication`,
      );
    if (!config.enableAutoPublish)
      return result("hold", "auto_publish_kill_switch_disabled");
    const human = validApproval(item),
      sensitive =
        /rumou?r|rumor|controvers|acusaci|accusat|lesi[oó]n|injur|sancion|doping|fallec|death|allegation|sensitive/i.test(
          candidate.event.event_type +
            " " +
            candidate.event.headline_working +
            " " +
            candidate.event.claims.map((c) => c.claim).join(" "),
        );
    const explicitlyScheduled =
      human && candidate.timing.mode === "scheduled_at";
    if (!candidate.consent.allowAutomatic)
      return result(
        "needs_human_approval",
        "input_not_authorized_for_automatic_publication",
      );
    if (
      (candidate.consent.risk !== "routine" || sensitive) &&
      !explicitlyScheduled
    )
      return result(
        "needs_human_approval",
        "sensitive_opinion_or_ambiguous_content",
      );
    if (
      all.some(
        (r) =>
          r.content.eventId === item.eventId &&
          r.publication.status === "published",
      ) &&
      !explicitlyScheduled
    )
      return result(
        "needs_human_approval",
        "previous_version_or_same_event_already_published",
      );
    return result(
      "auto_publish",
      "verified_structured_result",
      "rights_and_current_visual_qa_pass",
      "account_budget_window_and_frequency_pass",
    );
  }
}
