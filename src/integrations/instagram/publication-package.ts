import {
  current,
  type ContentItem,
  type Store,
  type Versions,
} from "../../domain/models.js";
import { assertReadyForApproval, assertRights } from "../../domain/guards.js";
import { packageHash, validApproval } from "../../approvals/service.js";
import { ensure, hash } from "../../common/core.js";
import { finalRenderInputs } from "../../render/visual-input.js";
import {
  DeterministicQualityGate,
  type GateResult,
} from "../../qa/deterministic-gate.js";
import { OutputValidator, SkillRegistry } from "../../skills/runtime.js";
import {
  prepareImage,
  type PreparedMedia,
  type HostedMedia,
} from "./hosting.js";
import { InstagramError } from "./errors.js";
import type { PublicationAuthority } from "../../approvals/publication-authority.js";

export interface PublicationPackage {
  readonly schemaVersion: 1;
  readonly contentId: string;
  readonly platform: "instagram";
  readonly accountId: string;
  readonly surface: "feed";
  readonly versions: Versions;
  readonly approvalId: string;
  readonly approvalAuthority?: "human" | "policy";
  readonly editorialPackageHash: string;
  readonly caption: string;
  readonly assetId: string;
  readonly finalAsset: PreparedMedia;
  readonly rights: unknown;
  readonly deterministicQA: GateResult;
  readonly aiQA: {
    reviewId: string;
    reviewHash: string;
    runId: string;
    provider: string;
    model: string | null;
  };
  readonly packageHash: string;
}
export interface InstagramPublicationRecord {
  accountId: string;
  containerId: string | null;
  igMediaId: string | null;
  permalink: string | null;
  captionVersion: number;
  assetVersion: number;
  publicationPackage: PublicationPackage;
  phase:
    "reserved" | "uploaded" | "container_created" | "publishing" | "published";
  hosted?: HostedMedia;
  error?: {
    code: string;
    retryable: boolean;
    metaCode?: number;
    metaSubcode?: number;
  };
  lease?: { owner: string; expiresAt: string };
  createdAt: string;
  updatedAt: string;
  cleanedAt?: string;
}
export function assertPackageCurrent(
  item: ContentItem,
  pkg: PublicationPackage,
  authority?: PublicationAuthority,
  store?: Store,
): void {
  const approval =
    pkg.approvalAuthority === "policy" && authority && store
      ? authority.assert(store, item)
      : validApproval(item);
  if (
    !approval ||
    approval.id !== pkg.approvalId ||
    packageHash(item) !== pkg.editorialPackageHash ||
    hash(item.versions) !== hash(pkg.versions)
  )
    throw new InstagramError("stale_approval");
  assertRights(item);
  const target = current(item.metadata)?.data.instagramTarget as
    { accountId?: string; surface?: string } | undefined;
  if (target?.accountId !== pkg.accountId || target.surface !== pkg.surface)
    throw new InstagramError("stale_approval");
  const final = finalRenderInputs(current(item.assets)?.data ?? []).find(
    (a) => a.assetId === pkg.assetId,
  );
  if (!final || final.sha256 !== pkg.finalAsset.sourceSha256)
    throw new InstagramError("stale_approval");
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export async function buildPublicationPackage(
  store: Store,
  item: ContentItem,
  accountId: string,
  validator = new OutputValidator(new SkillRegistry()),
  authority?: PublicationAuthority,
): Promise<PublicationPackage> {
  const approval = authority
    ? authority.assert(store, item)
    : validApproval(item);
  if (!approval) throw new InstagramError("stale_approval");
  ensure(
    ["human_approved", "ready_to_publish", "published"].includes(item.status),
    "Content is not approved for manual publishing",
  );
  assertReadyForApproval(item);
  const metadata = current(item.metadata)?.data;
  const target = metadata?.instagramTarget as
    { accountId?: string; surface?: string } | undefined;
  ensure(
    target?.accountId === accountId && target.surface === "feed",
    "Bind the connected account and feed surface before QA and human approval (cm:instagram:prepare)",
  );
  ensure(
    item.type === "single_image",
    "Real orchestration currently supports single-image feed only; Reel provider is fixture-tested, carousel/story interfaces are prepared",
  );
  const expiry = item.opportunity?.timing.expires_at;
  ensure(!expiry || Date.parse(expiry) > Date.now(), "Opportunity expired");
  const event = Object.values(store.events).find((e) => e.id === item.eventId);
  ensure(event, "Authoritative event missing");
  const deterministicQA = new DeterministicQualityGate(validator).inspect(
    store,
    item,
    event.data,
    "pre_publish",
    authority ? () => !!authority.assert(store, item) : undefined,
  );
  ensure(
    deterministicQA.passed,
    `Deterministic pre-publish QA failed: ${deterministicQA.issues.map((i) => i.code).join(", ")}`,
  );
  const review = current(item.reviews)!;
  const run = store.runs.findLast(
    (r) =>
      r.skill === "quality-reviewer" &&
      r.contentId === item.id &&
      r.status === "success" &&
      r.llmCall === true &&
      r.provider !== "fixture" &&
      r.provider !== "fixtures" &&
      hash(r.output) === hash(review.data),
  );
  ensure(
    run?.provider && review.data.simulated !== true,
    "Real publication requires independent AI QA of the final pixels; fixture QA cannot authorize it",
  );
  ensure(
    review.data.scope.publishing_route === "instagram_api_with_instagram_login",
    "AI QA must review the Instagram Login route bound in metadata",
  );
  const assets = current(item.assets)!.data;
  const rendered = assets.filter(
    (a) =>
      a.type === "graphic" &&
      a.stage === "rendered" &&
      a.metadata.actualMedia === true &&
      a.metadata.surface === "feed",
  );
  ensure(rendered.length === 1, "Select exactly one final feed render");
  ensure(
    !assets.some((a) => a.metadata.actualMedia === false),
    "Mock assets cannot enter a real publication package",
  );
  const asset = rendered[0]!,
    finalAsset = await prepareImage(asset);
  const attachments = (
    run.input as { visualAssets?: Array<{ assetId: string; sha256: string }> }
  )?.visualAssets;
  ensure(
    attachments?.some(
      (a) => a.assetId === asset.id && a.sha256 === finalAsset.sourceSha256,
    ),
    "AI QA evidence does not include the current final image hash",
  );
  const caption = current(item.copies)!.data.outputs.caption;
  ensure(
    typeof caption === "string" && caption.trim(),
    "Final caption is required",
  );
  ensure(
    [...caption].length <= 2200,
    "Instagram caption exceeds 2200 characters",
  );
  if (event.data.simulated === true)
    ensure(
      /prueba|demo|fictici/i.test(caption),
      "A fictitious event must be explicitly labeled in the public caption",
    );
  const data: Omit<PublicationPackage, "packageHash"> = {
    schemaVersion: 1,
    contentId: item.id,
    platform: "instagram",
    accountId,
    surface: "feed",
    versions: { ...item.versions },
    approvalId: approval.id,
    ...(authority ? { approvalAuthority: "policy" as const } : {}),
    editorialPackageHash: packageHash(item),
    caption,
    assetId: asset.id,
    finalAsset,
    rights: assets.map((a) => ({
      id: a.id,
      rights: a.rights,
      expiresAt: a.expiresAt ?? null,
      allowedPlatforms: a.allowedPlatforms ?? null,
      credit: a.credit,
      source: a.source,
    })),
    deterministicQA,
    aiQA: {
      reviewId: review.data.review_id,
      reviewHash: hash(review.data),
      runId: run.id,
      provider: run.provider,
      model: run.model,
    },
  };
  return freeze(structuredClone({ ...data, packageHash: hash(data) }));
}
export const instagramIdempotencyKey = (pkg: PublicationPackage) =>
  hash({
    contentId: pkg.contentId,
    publicationPackageHash: pkg.packageHash,
    platform: pkg.platform,
    account: pkg.accountId,
  });
