import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { demoEvent } from "../providers/mock/index.js";
import type { CommunityManagerOrchestrator } from "../orchestration/community-manager.js";
import type { SkillOutputs } from "../domain/models.js";

export async function seedVerifiedDemo(cm: CommunityManagerOrchestrator) {
  const strategy = JSON.parse(
    readFileSync(
      resolve("fixtures/skill-outputs/editorial-strategist.json"),
      "utf8",
    ),
  ) as SkillOutputs["editorial-strategist"];
  if (!(await cm.repository.read()).strategies.length)
    await cm.importEditorialPlan(strategy, "fixture-seed");
  return cm.importVerifiedEvent(
    demoEvent(),
    "fixture-seed: official fictitious verified ledger",
  );
}
/** Four editorial decisions, no research, strategy generation, analytics, approval or publishing. */
export async function runAIDemo(cm: CommunityManagerOrchestrator) {
  const event = await seedVerifiedDemo(cm);
  let content = await cm.runOpportunityPipeline(event.id);
  if (
    [
      "approved_for_production",
      "planning",
      "ready_for_qa",
      "ready_for_human_approval",
    ].includes(content.status)
  )
    content = await cm.runContentProduction(content.id);
  if (
    ["ready_for_qa", "ready_for_human_approval", "qa_failed"].includes(
      content.status,
    )
  )
    content = await cm.runQualityReview(content.id);
  return content;
}
