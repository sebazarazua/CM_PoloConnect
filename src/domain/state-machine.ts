import { CMError, id, now } from "../common/core.js";
import type { ContentItem, Status, Store } from "./models.js";

const transitions: Record<Status, readonly Status[]> = {
  detected: ["researching", "archived"],
  researching: ["verified", "blocked", "archived"],
  verified: ["opportunity_created", "blocked", "archived"],
  opportunity_created: ["approved_for_production", "blocked", "archived"],
  approved_for_production: ["planning", "blocked", "archived"],
  planning: ["awaiting_assets", "in_production", "blocked", "qa_failed"],
  awaiting_assets: ["planning", "in_production", "blocked", "archived"],
  blocked: [
    "researching",
    "verified",
    "opportunity_created",
    "planning",
    "ready_for_qa",
    "archived",
  ],
  in_production: ["ready_for_qa", "awaiting_assets", "blocked", "planning"],
  ready_for_qa: [
    "ready_for_human_approval",
    "qa_failed",
    "blocked",
    "planning",
  ],
  qa_failed: ["researching", "planning", "ready_for_qa", "blocked", "archived"],
  ready_for_human_approval: [
    "ready_to_publish",
    "human_approved",
    "human_rejected",
    "planning",
    "blocked",
    "qa_failed",
  ],
  human_rejected: ["planning", "archived"],
  human_approved: ["ready_to_publish", "planning", "blocked", "qa_failed"],
  ready_to_publish: ["published", "planning", "blocked", "qa_failed"],
  published: ["measuring", "planning", "blocked", "archived"],
  measuring: ["analyzed", "blocked", "planning"],
  analyzed: ["archived", "planning", "measuring", "blocked"],
  archived: [],
};
export function canTransition(from: Status, to: Status): boolean {
  return from === to || transitions[from].includes(to);
}
export function transition(
  store: Store,
  item: ContentItem,
  to: Status,
  detail: unknown = {},
): void {
  if (item.status === to) return;
  if (!canTransition(item.status, to))
    throw new CMError(
      "permanent_error",
      `Illegal transition ${item.status} -> ${to}`,
    );
  const from = item.status;
  item.status = to;
  item.updatedAt = now();
  store.audit.push({
    id: id("audit"),
    contentId: item.id,
    kind: "state_changed",
    from,
    to,
    at: now(),
    detail,
  });
}
export const ownerFor = (code: string, type: ContentItem["type"]): string => {
  if (/verification|facts|score/.test(code)) return "polo-news-researcher";
  if (/copy/.test(code)) return "copywriter";
  if (/replan|strategy|timing|expired|duplicate/.test(code))
    return "content-opportunity-detector";
  if (/brand/.test(code)) return "brand-owner";
  if (/rights|assets/.test(code)) return "asset-rights-owner";
  return type === "reel" ? "reel-planner" : "social-designer";
};
