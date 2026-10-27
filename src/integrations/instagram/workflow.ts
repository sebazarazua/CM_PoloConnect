import { resolve } from "node:path";
import { ensure, hash } from "../../common/core.js";
import { current, type Asset, type ContentItem } from "../../domain/models.js";
import type { EditorialRepository } from "../../persistence/repository.js";
import { CommunityManagerOrchestrator } from "../../orchestration/community-manager.js";
import { mockProviders } from "../../providers/mock/index.js";
import { LocalDesignRenderer } from "../../render/provider.js";
import { productionMark } from "../../render/brand.js";
import { seedVerifiedDemo } from "../../workflows/demo.js";
import { selectedAISettings, selectedExecutor } from "../../ai/factory.js";
import { FixtureSkillExecutor } from "../../skills/fixture-executor.js";
import { packageHash } from "../../approvals/service.js";

export async function bindInstagramTarget(
  cm: CommunityManagerOrchestrator,
  contentId: string,
  accountId: string,
  actor: string,
) {
  ensure(
    /^\d+$/.test(accountId),
    "Connect an Instagram account before binding a real publication target",
  );
  const item = (await cm.repository.read()).contents[contentId];
  ensure(item, "Unknown content ID");
  const metadata = {
    ...current(item.metadata)?.data,
    instagramTarget: { accountId, surface: "feed" },
    publishingRoute: "instagram_api_with_instagram_login",
  };
  if (hash(metadata) === hash(current(item.metadata)?.data)) return item;
  return cm.reviseContent(contentId, { metadata }, actor);
}
/** Real pixels, no documentary photo fabrication, explicit fictitious result, never approval or publishing. */
export async function prepareInstagramDemo(
  repository: EditorialRepository,
  accountId: string,
  options: { fixture?: boolean; contentId?: string; actor?: string } = {},
) {
  ensure(
    /^\d+$/.test(accountId),
    "Connect Instagram before generating a real publication (or use --fixture for an offline preview)",
  );
  const settings = selectedAISettings();
  ensure(
    options.fixture || settings.enabled,
    "cm:demo-real requires configured real AI and ENABLE_REAL_AI=true; --fixture renders a local preview that cannot authorize real publishing",
  );
  const providers = mockProviders(),
    mark = productionMark("dark");
  const brandAsset: Asset = {
    id: "polo-connect-owned-icon",
    type: "logo",
    stage: "approved",
    storageRef: mark.path,
    rights: "owned",
    required: true,
    source: "User-supplied Polo Connect app icon; normalized brand pack",
    credit: "Polo Connect",
    metadata: {
      actualMedia: true,
      sha256: mark.sha256,
      width: mark.width,
      height: mark.height,
      mimeType: "image/png",
    },
  };
  providers.assets = {
    findForEvent: async () => [structuredClone(brandAsset)],
    get: async (id) =>
      id === brandAsset.id ? structuredClone(brandAsset) : null,
    save: async () => {},
  };
  const renderer = new LocalDesignRenderer(resolve("outputs/instagram-ready"), [
    "feed",
  ]);
  providers.design = renderer;
  const cm = new CommunityManagerOrchestrator(
    repository,
    providers,
    options.fixture ? new FixtureSkillExecutor() : selectedExecutor(settings),
    undefined,
    settings,
  );
  try {
    let content: ContentItem;
    if (options.contentId) {
      const item = (await repository.read()).contents[options.contentId];
      ensure(item, "Unknown content ID");
      content = item;
    } else {
      const event = await seedVerifiedDemo(cm);
      content = await cm.runOpportunityPipeline(event.id, "single_image");
    }
    content = await bindInstagramTarget(
      cm,
      content.id,
      accountId,
      options.actor ?? "manual-cli-prepare",
    );
    const productionCurrent =
      current(content.plans) &&
      !current(content.plans)?.stale &&
      current(content.copies) &&
      !current(content.copies)?.stale &&
      current(content.assets)?.data.some(
        (a) => a.stage === "rendered" && a.metadata.actualMedia === true,
      );
    if (!productionCurrent) content = await cm.runContentProduction(content.id);
    // Label the controlled demo in the public caption, keeping source facts unchanged. Never edit a real event here.
    const state = await repository.read(),
      event = Object.values(state.events).find((e) => e.id === content.eventId);
    const copy = current(content.copies)?.data;
    if (
      event?.data.simulated === true &&
      copy &&
      typeof copy.outputs.caption === "string" &&
      !/^PRUEBA TÉCNICA/i.test(copy.outputs.caption)
    ) {
      const labelled = structuredClone(copy);
      labelled.outputs.caption = `PRUEBA TÉCNICA · Resultado ficticio de demostración.\n\n${copy.outputs.caption}`;
      content = await cm.reviseContent(
        content.id,
        { copy: labelled },
        options.actor ?? "manual-cli-prepare",
      );
    }
    if (
      ["ready_for_qa", "qa_failed", "ready_for_human_approval"].includes(
        content.status,
      )
    )
      content = await cm.runQualityReview(content.id);
    return {
      contentId: content.id,
      status: content.status,
      packageHash: packageHash(content),
      mode: options.fixture
        ? "fixture_preview_NOT_publishable"
        : "real_AI_real_render",
      caption: current(content.copies)?.data.outputs.caption,
      render: current(content.assets)
        ?.data.filter((a) => a.stage === "rendered")
        .map((a) => a.storageRef),
      blockers: content.blockers,
      approval: "manual_required",
      publication: "not_requested",
    };
  } finally {
    await renderer.close();
  }
}
