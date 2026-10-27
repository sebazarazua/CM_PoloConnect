import { randomUUID } from "node:crypto";
import type { EditorialRepository } from "../../persistence/repository.js";
import { current, type Publication } from "../../domain/models.js";
import { id, now, ensure } from "../../common/core.js";
import { transition } from "../../domain/state-machine.js";
import { packageHash } from "../../approvals/service.js";
import {
  buildPublicationPackage,
  instagramIdempotencyKey,
  assertPackageCurrent,
  type InstagramPublicationRecord,
  type PublicationPackage,
} from "./publication-package.js";
import { InstagramError, publicationError } from "./errors.js";
import type { InstagramPublishingContract } from "./provider.js";
import type { MediaHostingProvider } from "./hosting.js";
import type { PublicationAuthority } from "../../approvals/publication-authority.js";

/** Persist intent before each external mutation. Never automatically repeat an uncertain media_publish. */
export class InstagramPublicationService {
  constructor(
    private repository: EditorialRepository,
    private provider: InstagramPublishingContract,
    private hosting: MediaHostingProvider,
    private enabled: boolean,
    private fixtureTransport = false,
    private authority?: PublicationAuthority,
  ) {}
  async reconcile(
    contentId: string,
    publicationId: string,
    accountId: string,
    mediaId: string,
    actor: string,
  ): Promise<Publication> {
    ensure(
      actor.trim(),
      "Reconciliation requires an identified human reviewer",
    );
    const store = await this.repository.read(),
      p = store.contents[contentId]?.publications.find(
        (p) => p.id === publicationId,
      ),
      record = p?.instagram;
    ensure(
      p &&
        record &&
        record.accountId === accountId &&
        ["unknown", "publishing"].includes(p.status),
      "No uncertain publication for this account",
    );
    ensure(
      !record.lease || Date.parse(record.lease.expiresAt) <= Date.now(),
      "Wait until the active publisher lease expires",
    );
    await this.provider.checkConnection();
    ensure(record.containerId, "Container ID is required to reconcile");
    ensure(
      (await this.provider.getContainer(record.containerId)).status ===
        "PUBLISHED",
      "Meta has not confirmed this container was published; retrying media_publish remains blocked",
    );
    const confirmed = await this.provider.inspectPublished(
      mediaId,
      record.publicationPackage.caption,
      record.createdAt,
    );
    return this.repository.transaction(async (s) => {
      ensure(
        !Object.values(s.contents).some((c) =>
          c.publications.some(
            (other) =>
              other.id !== publicationId &&
              other.instagram?.igMediaId === mediaId,
          ),
        ),
        "Media ID already belongs to a different publication",
      );
      const item = s.contents[contentId]!,
        publication = item.publications.find((p) => p.id === publicationId)!;
      ensure(
        publication.status === "unknown" || publication.status === "publishing",
        "Publication changed during reconciliation",
      );
      publication.status = "published";
      publication.externalId = mediaId;
      publication.publishedAt = now();
      Object.assign(publication.instagram!, {
        phase: "published",
        igMediaId: confirmed.id,
        permalink: confirmed.permalink,
        updatedAt: now(),
      });
      delete publication.instagram!.error;
      delete publication.instagram!.lease;
      if (
        packageHash(item) === record.publicationPackage.editorialPackageHash
      ) {
        if (item.status === "human_approved")
          transition(s, item, "ready_to_publish");
        if (item.status === "ready_to_publish")
          transition(s, item, "published");
      }
      s.audit.push({
        id: id("audit"),
        contentId,
        kind: "instagram_manual_reconciliation",
        at: now(),
        detail: {
          actor,
          publicationId,
          mediaId,
          containerId: record.containerId,
        },
      });
      return publication;
    });
  }
  async publish(
    contentId: string,
    accountId: string,
    explicitCLI: boolean,
  ): Promise<Publication> {
    if (!this.enabled || (!explicitCLI && !this.authority))
      throw new InstagramError("publishing_disabled");
    ensure(
      this.hosting.name === "s3" || this.fixtureTransport,
      "Real publishing requires S3 hosting",
    );
    const owner = randomUUID();
    const reserved = await this.repository.transaction(async (store) => {
      const item = store.contents[contentId];
      ensure(item, "Unknown content ID");
      // Successful retries return the durable receipt even after rights expiry or source archival.
      const previous = item.publications.findLast(
        (p) =>
          p.provider === "instagram" &&
          p.instagram?.accountId === accountId &&
          p.status === "published" &&
          p.instagram.publicationPackage.editorialPackageHash ===
            p.packageHash &&
          p.packageHash === packageHash(item),
      );
      if (previous) return { publication: previous, done: true };
      if (
        item.publications.some(
          (p) =>
            p.provider === "instagram" &&
            p.instagram?.accountId === accountId &&
            ["publishing", "unknown"].includes(p.status),
        )
      )
        throw new InstagramError("reconciliation_required");
      const pkg = await buildPublicationPackage(
        store,
        item,
        accountId,
        undefined,
        this.authority,
      );
      const key = instagramIdempotencyKey(pkg);
      let publication = item.publications.find((p) => p.idempotencyKey === key);
      if (publication?.status === "published")
        return { publication, done: true };
      if (publication && ["publishing", "unknown"].includes(publication.status))
        throw new InstagramError("reconciliation_required");
      if (
        publication?.instagram?.lease &&
        Date.parse(publication.instagram.lease.expiresAt) > Date.now()
      )
        throw new InstagramError("busy", true);
      if (
        publication?.instagram?.error &&
        !publication.instagram.error.retryable &&
        !["expired_token", "missing_permission"].includes(
          publication.instagram.error.code,
        )
      )
        throw new InstagramError("reconciliation_required");
      if (!publication) {
        publication = {
          id: id("publication"),
          provider: "instagram",
          idempotencyKey: key,
          scheduledAt: null,
          publishedAt: null,
          externalId: null,
          status: "pending",
          versions: { ...item.versions },
          packageHash: pkg.editorialPackageHash,
          payload: {
            contentId: item.id,
            platform: "instagram",
            versions: { ...item.versions },
            packageHash: pkg.editorialPackageHash,
            copy: current(item.copies)!.data,
            assets: current(item.assets)!.data,
            metadata: current(item.metadata)!.data,
            simulated: false,
          },
          instagram: {
            accountId,
            containerId: null,
            igMediaId: null,
            permalink: null,
            captionVersion: item.versions.copy,
            assetVersion: item.versions.asset,
            publicationPackage: pkg,
            phase: "reserved",
            createdAt: now(),
            updatedAt: now(),
          },
        };
        item.publications.push(publication);
      }
      publication.instagram!.lease = {
        owner,
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
      };
      delete publication.instagram!.error;
      store.audit.push({
        id: id("audit"),
        contentId,
        kind: this.authority
          ? "instagram_policy_publish_requested"
          : "instagram_manual_publish_requested",
        at: now(),
        detail: {
          publicationId: publication.id,
          packageHash: pkg.packageHash,
          accountId,
        },
      });
      return { publication, done: false };
    });
    if (reserved.done) return reserved.publication;
    const publicationId = reserved.publication.id;
    let record = reserved.publication.instagram!;
    const pkg = record.publicationPackage;
    let publishStarted = false;
    const checkpoint = async (
      phase: InstagramPublicationRecord["phase"],
      patch: Partial<InstagramPublicationRecord> = {},
    ) =>
      this.repository.transaction(async (store) => {
        const item = store.contents[contentId]!,
          publication = item.publications.find((p) => p.id === publicationId)!;
        ensure(
          publication.instagram?.lease?.owner === owner,
          "Publication lease changed; stop and reconcile",
        );
        if (phase === "publishing")
          assertPackageCurrent(item, pkg, this.authority, store);
        Object.assign(publication.instagram, patch, {
          phase,
          updatedAt: now(),
        });
        publication.status =
          phase === "published"
            ? "published"
            : phase === "publishing"
              ? "publishing"
              : "processing";
        if (phase === "published") {
          publication.externalId = publication.instagram.igMediaId;
          publication.publishedAt = now();
          delete publication.instagram.lease;
          if (item.status === "human_approved")
            transition(store, item, "ready_to_publish");
          if (item.status === "ready_to_publish")
            transition(store, item, "published", { publicationId });
        }
        store.audit.push({
          id: id("audit"),
          contentId,
          kind: `instagram_${phase}`,
          at: now(),
          detail: {
            publicationId,
            containerId: publication.instagram.containerId,
            igMediaId: publication.instagram.igMediaId,
            packageHash: pkg.packageHash,
          },
        });
        return publication;
      });
    try {
      const identity = await this.provider.checkConnection();
      ensure(
        identity.accountId === accountId,
        "Connected Instagram account changed",
      );
      if (!record.containerId) {
        const uploaded = await this.hosting.upload(
          pkg.finalAsset,
          pkg.packageHash,
        );
        await checkpoint("uploaded", { hosted: uploaded.reference });
        await this.hosting.assertAccessible(uploaded.url, pkg.finalAsset);
        const containerId = await this.provider.createContainer({
          surface: pkg.surface,
          mediaURL: uploaded.url,
          caption: pkg.caption,
        });
        record = (await checkpoint("container_created", { containerId }))
          .instagram!;
      }
      const container = await this.provider.waitForContainer(
        record.containerId!,
      );
      if (container.status === "PUBLISHED")
        throw new InstagramError("reconciliation_required");
      await checkpoint("publishing");
      publishStarted = true;
      const igMediaId = await this.provider.publishContainer(
        record.containerId!,
      );
      // Commit the media ID before fetching optional permalink. A permalink error cannot cause a second post.
      let result = await checkpoint("published", { igMediaId });
      publishStarted = false;
      try {
        const permalink = await this.provider.permalink(igMediaId);
        result = await this.repository.transaction(async (s) => {
          const p = s.contents[contentId]!.publications.find(
            (p) => p.id === publicationId,
          )!;
          p.instagram!.permalink = permalink;
          return p;
        });
      } catch {
        /* Receipt is already durable. Permalink can be looked up later. */
      }
      return result;
    } catch (error) {
      const normalized = publicationError(error);
      await this.repository.transaction(async (store) => {
        const p = store.contents[contentId]!.publications.find(
          (p) => p.id === publicationId,
        )!;
        if (p.status === "published") return;
        const definiteRejection = [
          "expired_token",
          "missing_permission",
          "rate_limit",
          "invalid_media",
          "container_failed",
          "media_url_inaccessible",
        ].includes(normalized.code);
        const uncertain =
          (publishStarted && !definiteRejection) ||
          normalized.code === "reconciliation_required";
        p.status = uncertain ? "unknown" : "failed";
        p.instagram!.error = uncertain
          ? { code: "reconciliation_required", retryable: false }
          : normalized.toJSON();
        p.instagram!.updatedAt = now();
        delete p.instagram!.lease;
        store.audit.push({
          id: id("audit"),
          contentId,
          kind: "instagram_publish_error",
          at: now(),
          detail: { publicationId, error: p.instagram!.error },
        });
      });
      if (
        publishStarted &&
        ![
          "expired_token",
          "missing_permission",
          "rate_limit",
          "invalid_media",
          "container_failed",
          "media_url_inaccessible",
        ].includes(normalized.code)
      )
        throw new InstagramError("reconciliation_required");
      throw normalized;
    }
  }
}

export function publicationSummary(p: Publication) {
  return {
    contentId: p.payload.contentId,
    provider: p.provider,
    status: p.status,
    publicationId: p.id,
    account: p.instagram?.accountId ?? null,
    igMediaId: p.instagram?.igMediaId ?? p.externalId,
    containerId: p.instagram?.containerId ?? null,
    publishedAt: p.publishedAt,
    permalink: p.instagram?.permalink ?? null,
    captionVersion: p.versions.copy,
    assetVersion: p.versions.asset,
    publicationPackageHash:
      p.instagram?.publicationPackage.packageHash ?? p.packageHash,
    error: p.instagram?.error ?? null,
  };
}
export type { PublicationPackage };
