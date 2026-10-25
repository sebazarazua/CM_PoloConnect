import { ensure, now } from "../common/core.js";
import {
  current,
  isReelPlan,
  type ContentItem,
  type PublishPackage,
} from "./models.js";
import { packageHash, validApproval } from "../approvals/service.js";

export function assertRights(item: ContentItem, platform = "instagram"): void {
  const assets = current(item.assets);
  ensure(
    assets && !assets.stale,
    "Required assets missing or stale",
    "asset-rights-owner",
  );
  for (const a of assets.data) {
    // All attached assets enter the payload, including optional assets selected by production.
    ensure(
      ["owned", "licensed", "permission_confirmed"].includes(a.rights),
      `blocked_rights: ${a.id} (${a.rights})`,
      "asset-rights-owner",
    );
    ensure(
      !a.expiresAt || Date.parse(a.expiresAt) > Date.now(),
      `blocked_rights: expired ${a.id}`,
      "asset-rights-owner",
    );
    ensure(
      !a.allowedPlatforms || a.allowedPlatforms.includes(platform),
      `blocked_rights: platform ${a.id}`,
      "asset-rights-owner",
    );
  }
  const plan = current(item.plans)?.data;
  if (plan && isReelPlan(plan)) {
    ensure(
      ["owned", "licensed", "permission_confirmed", "not_applicable"].includes(
        plan.rights.audio_status,
      ),
      "blocked_rights: audio",
      "asset-rights-owner",
    );
    for (const clip of plan.footage.filter(
      (c) => c.selection_status !== "avoid",
    ))
      ensure(
        assets.data.some((a) => a.id === clip.source_id),
        `blocked_assets: clip ${clip.source_id}`,
        "asset-rights-owner",
      );
  }
}
export function assertReadyForApproval(item: ContentItem): void {
  ensure(item.blockers.length === 0, "Unresolved blockers");
  ensure(
    current(item.copies) && !current(item.copies)?.stale,
    "Missing/stale copy",
    "copywriter",
  );
  ensure(
    current(item.plans) && !current(item.plans)?.stale,
    "Missing/stale creative plan",
  );
  assertRights(item);
  const review = current(item.reviews);
  ensure(
    review &&
      !review.stale &&
      review.data.decision === "pass_for_human_approval",
    "QA has not passed",
  );
  ensure(
    review.data.review_mode === "full" &&
      review.data.review_stage === "post_render",
    "Full post-render QA is required",
  );
  ensure(
    Object.values(review.data.checks).every(
      (check) => check === "pass" || check === "not_applicable",
    ),
    "QA has unresolved checks",
  );
  ensure(
    review.data.checks.facts === "pass" && review.data.checks.rights === "pass",
    "Facts and rights checks must pass",
  );
  ensure(
    review.data.versions.asset_version === String(item.versions.asset) &&
      review.data.versions.copy_version === String(item.versions.copy) &&
      review.data.versions.metadata_version === String(item.versions.metadata),
    "QA versions do not match",
  );
}
export function publishPackage(item: ContentItem): PublishPackage {
  ensure(validApproval(item), "Human approval missing or invalidated");
  ensure(
    item.status === "human_approved" || item.status === "ready_to_publish",
    "Invalid publish state",
  );
  ensure(!item.blockers.length, "Unresolved blockers");
  assertRights(item);
  const expiry = item.opportunity?.timing.expires_at;
  ensure(
    !expiry || Date.parse(expiry) > Date.parse(now()),
    "expired opportunity",
    "content-opportunity-detector",
  );
  const copy = current(item.copies);
  ensure(copy && !copy.stale, "Copy is stale");
  ensure(current(item.plans) && !current(item.plans)?.stale, "Plan is stale");
  const review = current(item.reviews);
  ensure(review && !review.stale, "Review is stale");
  ensure(
    ["pass_for_human_approval", "pass_for_publish"].includes(
      review.data.decision,
    ),
    "QA did not pass",
  );
  return {
    contentId: item.id,
    platform: "instagram",
    versions: { ...item.versions },
    packageHash: packageHash(item),
    copy: copy.data,
    assets: current(item.assets)!.data,
    metadata: current(item.metadata)!.data,
    simulated: true,
  };
}
