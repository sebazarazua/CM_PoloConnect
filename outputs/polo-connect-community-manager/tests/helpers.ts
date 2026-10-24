import { CommunityManagerOrchestrator } from "../src/orchestration/community-manager.js";
import {
  MemoryRepository,
  type EditorialRepository,
} from "../src/persistence/repository.js";
import { mockProviders } from "../src/providers/mock/index.js";
import { packageHash } from "../src/approvals/service.js";
import type { ContentItem } from "../src/domain/models.js";
import type { SkillExecutor } from "../src/skills/runtime.js";
export function createCM(
  repository: EditorialRepository = new MemoryRepository(),
  executor?: SkillExecutor,
) {
  return new CommunityManagerOrchestrator(
    repository,
    mockProviders(),
    executor,
  );
}
export async function ready(
  cm: CommunityManagerOrchestrator,
  type: ContentItem["type"] = "single_image",
) {
  const [event] = await cm.runDailyDiscovery();
  const item = await cm.runOpportunityPipeline(event!.id, type);
  await cm.runContentProduction(item.id);
  return cm.runQualityReview(item.id);
}
export async function approved(cm: CommunityManagerOrchestrator) {
  const c = await ready(cm);
  return cm.approveContent(c.id, "human-fixture-reviewer", packageHash(c));
}
