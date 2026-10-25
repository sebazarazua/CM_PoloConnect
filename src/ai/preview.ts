import {
  current,
  type ContentItem,
  type SkillName,
  type Store,
} from "../domain/models.js";
import { editorialSummary } from "./context.js";
import type { SkillInput, SkillRunner } from "../skills/runtime.js";
import { DeterministicQualityGate } from "../qa/deterministic-gate.js";

export function previewInput(
  store: Store,
  c: ContentItem,
  skill: SkillName,
  runner: SkillRunner,
): SkillInput {
  const event = Object.values(store.events).find(
    (e) => e.id === c.eventId,
  )?.data;
  const assets =
    current(c.assets)?.data.filter((a) => a.stage !== "rendered") ?? [];
  const context = {
    editorial: {
      timezone: "America/Buenos_Aires",
      language: "es-AR",
      platform: "instagram",
      requireHumanApproval: true,
      version: "0.1.0",
    },
    ...(editorialSummary(store, runner.ai, c.id) as object),
  };
  if (skill === "quality-reviewer")
    return {
      event,
      content: c,
      format: c.type,
      stage: "post_render",
      context,
      reason: "Independent editorial judgment after deterministic checks",
      ...(event
        ? {
            deterministicGate: new DeterministicQualityGate(
              runner.validator,
            ).inspect(store, c, event),
          }
        : {}),
    };
  return {
    event,
    opportunity:
      skill === "content-opportunity-detector"
        ? undefined
        : (c.opportunity ?? undefined),
    content: skill === "copywriter" ? c : undefined,
    assets,
    format: c.type,
    context,
    reason: "Read-only preview of a relevant editorial decision",
  };
}
export function nextSkill(c: ContentItem): SkillName | null {
  if (!c.opportunity) return "content-opportunity-detector";
  if (!current(c.plans) || current(c.plans)?.stale)
    return c.type === "reel" ? "reel-planner" : "social-designer";
  if (!current(c.copies) || current(c.copies)?.stale) return "copywriter";
  if (!current(c.reviews) || current(c.reviews)?.stale)
    return "quality-reviewer";
  return null;
}
