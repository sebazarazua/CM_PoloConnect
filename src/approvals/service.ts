import { ensure, hash, id, now } from "../common/core.js";
import { finalRenderInputs } from "../render/visual-input.js";
import {
  current,
  type Approval,
  type ContentItem,
  type Store,
} from "../domain/models.js";
import { transition } from "../domain/state-machine.js";

export function packageHash(item: ContentItem): string {
  return hash({
    contentId: item.id,
    versions: {
      asset: item.versions.asset,
      copy: item.versions.copy,
      metadata: item.versions.metadata,
    },
    assets: current(item.assets)?.data,
    copy: current(item.copies)?.data,
    plan: current(item.plans)?.data,
    metadata: current(item.metadata)?.data,
  });
}
export function pendingApproval(item: ContentItem): Approval {
  const approval: Approval = {
    id: id("approval"),
    state: "pending_approval",
    approver: null,
    at: now(),
    versions: { ...item.versions },
    packageHash: packageHash(item),
  };
  item.approvals.push(approval);
  return approval;
}
export function validApproval(item: ContentItem): Approval | undefined {
  try {
    finalRenderInputs(current(item.assets)?.data ?? []);
  } catch {
    return undefined;
  }
  const a = item.approvals.at(-1);
  return a?.state === "approved" &&
    !a.invalidatedAt &&
    a.packageHash === packageHash(item) &&
    hash(a.versions) === hash(item.versions)
    ? a
    : undefined;
}
export function approve(
  store: Store,
  item: ContentItem,
  actor: string,
  expectedHash: string,
  comment?: string,
): Approval {
  ensure(actor.trim(), "An identified human approver is required");
  finalRenderInputs(current(item.assets)?.data ?? []);
  ensure(
    item.status === "ready_for_human_approval",
    "Content is not awaiting approval",
  );
  ensure(
    expectedHash === packageHash(item),
    "Version changed; inspect the current package before approving",
  );
  const a = item.approvals.at(-1);
  ensure(a?.state === "pending_approval", "Missing pending approval");
  ensure(hash(a.versions) === hash(item.versions), "Pending approval is stale");
  a.state = "approved";
  a.approver = actor;
  a.at = now();
  a.comment = comment;
  transition(store, item, "human_approved", { approvalId: a.id, actor });
  store.audit.push({
    id: id("audit"),
    contentId: item.id,
    kind: "human_approval",
    at: now(),
    detail: { actor, versions: a.versions, packageHash: a.packageHash },
  });
  return a;
}
export function invalidate(
  store: Store,
  item: ContentItem,
  reason: string,
): void {
  for (const a of item.approvals)
    if (!a.invalidatedAt) {
      a.invalidatedAt = now();
      a.invalidationReason = reason;
    }
  // A scheduled payload must never survive a material edit.
  for (const p of item.publications)
    if (p.status === "scheduled" || p.status === "pending")
      p.status = "cancelled";
  for (const r of item.reviews) r.stale = true;
  item.blockers = [];
  store.audit.push({
    id: id("audit"),
    contentId: item.id,
    kind: "reapproval_required",
    at: now(),
    detail: { reason, versions: item.versions },
  });
}
