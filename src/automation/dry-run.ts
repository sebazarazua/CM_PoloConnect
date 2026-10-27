import { ensure } from "../common/core.js";
import type { EditorialRepository } from "../persistence/repository.js";
import type { ContentItem } from "../domain/models.js";
import { buildPublicationPackage } from "../integrations/instagram/publication-package.js";
import type { InstagramPublishingContract } from "../integrations/instagram/provider.js";
import type { MediaHostingProvider } from "../integrations/instagram/hosting.js";
import type { PolicyDecision } from "./types.js";
import { emptyAutomation } from "./types.js";
/** Stages real media and container when authorized by the dry-run policy; never calls media_publish. */
export class InstagramDryRunStage {
  constructor(
    private repository: EditorialRepository,
    private provider: InstagramPublishingContract,
    private hosting: MediaHostingProvider,
    private fixture = false,
  ) {}
  async prepare(item: ContentItem, decision: PolicyDecision, cycleId: string) {
    ensure(
      decision.verdict === "auto_publish",
      "Dry-run staging requires a passing policy",
    );
    ensure(
      this.hosting.name === "s3" || this.fixture,
      "Real dry-run staging requires S3",
    );
    const state = await this.repository.read();
    const preview = structuredClone(item);
    preview.status = "ready_to_publish";
    const pkg = await buildPublicationPackage(
      state,
      preview,
      decision.accountId,
      undefined,
      { kind: "policy", assert: () => ({ id: `preview:${decision.id}` }) },
    );
    const profile = await this.provider.checkConnection();
    ensure(
      profile.accountId === decision.accountId,
      "Dry-run connected account mismatch",
    );
    const previous = state.automation?.dryRunMedia[pkg.packageHash];
    if (
      previous &&
      !previous.cleanedAt &&
      Date.parse(previous.preparedAt) > Date.now() - 23 * 3600000
    ) {
      ensure(
        (await this.provider.waitForContainer(previous.containerId)).status ===
          "FINISHED",
        "Cached dry-run container is not ready",
      );
      return {
        packageHash: pkg.packageHash,
        containerId: previous.containerId,
        cached: true,
      };
    }
    const uploaded = await this.hosting.upload(pkg.finalAsset, pkg.packageHash);
    await this.hosting.assertAccessible(uploaded.url, pkg.finalAsset);
    const containerId = await this.provider.createContainer({
      surface: "feed",
      mediaURL: uploaded.url,
      caption: pkg.caption,
    });
    await this.repository.transaction(async (s) => {
      ensure(
        s.automation?.lease?.owner === cycleId,
        "Dry-run cycle lease lost",
      );
      (s.automation ??= emptyAutomation()).dryRunMedia[pkg.packageHash] = {
        packageHash: pkg.packageHash,
        containerId,
        hosted: uploaded.reference,
        preparedAt: new Date().toISOString(),
      };
    });
    const container = await this.provider.waitForContainer(containerId);
    ensure(container.status === "FINISHED", "Dry-run container is not ready");
    return { packageHash: pkg.packageHash, containerId, cached: false };
  }
}
