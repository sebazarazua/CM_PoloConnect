import { ensure, hash, id, now } from "../common/core.js";
import { current, type ContentItem, type Store } from "../domain/models.js";
import { packageHash } from "../approvals/service.js";
import { assertReadyForApproval } from "../domain/guards.js";
import { transition } from "../domain/state-machine.js";
import type { PublicationAuthority } from "../approvals/publication-authority.js";
import { AutomaticPublishingPolicy } from "./policy.js";
import { policyConfigHash, type AutomationConfig } from "./config.js";
import {
  emptyAutomation,
  type ContentCandidate,
  type PolicyDecision,
} from "./types.js";

export function grantPolicyApproval(
  store: Store,
  item: ContentItem,
  decision: PolicyDecision,
) {
  ensure(
    decision.verdict === "auto_publish" &&
      decision.packageHash === packageHash(item) &&
      hash(decision.versions) === hash(item.versions),
    "Policy decision is stale or denied",
  );
  assertReadyForApproval(item);
  const state = (store.automation ??= emptyAutomation()),
    approvals = (state.policyApprovals[item.id] ??= []);
  const existing = approvals.find(
    (a) => a.decisionId === decision.id && Date.parse(a.expiresAt) > Date.now(),
  );
  if (existing) return existing;
  const approval = {
    id: id("policy-approval"),
    decisionId: decision.id,
    accountId: decision.accountId,
    packageHash: decision.packageHash,
    versions: { ...item.versions },
    at: now(),
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    policyConfigHash: decision.configHash,
  };
  approvals.push(approval);
  if (
    item.status === "ready_for_human_approval" ||
    item.status === "human_approved"
  )
    transition(store, item, "ready_to_publish", {
      authority: "policy",
      decisionId: decision.id,
    });
  store.audit.push({
    id: id("audit"),
    contentId: item.id,
    kind: "auto_approved_by_policy",
    at: now(),
    detail: {
      approvalId: approval.id,
      decisionId: decision.id,
      packageHash: approval.packageHash,
      accountId: approval.accountId,
    },
  });
  return approval;
}
export class AutomaticPublicationAuthority implements PublicationAuthority {
  readonly kind = "policy" as const;
  constructor(
    private candidate: ContentCandidate,
    private config: () => AutomationConfig,
    private cycleId: string,
    private clock = () => new Date(),
  ) {}
  assert(store: Store, item: ContentItem) {
    const config = this.config(),
      state = store.automation,
      clock = this.clock();
    ensure(
      config.mode === "automatic" &&
        config.enableAutoPublish &&
        config.enableRealPublishing &&
        !config.dryRun,
      "Automatic publishing flags/kill switch do not authorize a live publication",
    );
    ensure(
      state?.lease?.owner === this.cycleId &&
        Date.parse(state.lease.expiresAt) > clock.getTime(),
      "Automation lease is missing or expired",
    );
    const approval = state.policyApprovals[item.id]?.at(-1);
    ensure(
      approval &&
        approval.accountId === config.accountId &&
        approval.packageHash === packageHash(item) &&
        hash(approval.versions) === hash(item.versions) &&
        approval.policyConfigHash === policyConfigHash(config) &&
        Date.parse(approval.expiresAt) > clock.getTime(),
      "Policy approval is missing, expired or stale",
    );
    const decision = new AutomaticPublishingPolicy().evaluate(
      store,
      item,
      this.candidate,
      config,
      clock,
      this.cycleId,
    );
    ensure(
      decision.verdict === "auto_publish",
      `Policy no longer permits publication: ${decision.reason.join(", ")}`,
    );
    ensure(current(item.metadata)?.data.instagramTarget, "Target missing");
    return { id: approval.id };
  }
}
