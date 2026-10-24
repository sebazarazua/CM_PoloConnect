import type { NewsEvent } from "../skills/generated/polo-news-researcher.js";
import type { ContentOpportunity } from "../skills/generated/content-opportunity-detector.js";
import type { ReelPlan } from "../skills/generated/reel-planner.js";
import type { SocialDesignPlan } from "../skills/generated/social-designer.js";
import type { SocialCopy } from "../skills/generated/copywriter.js";
import type { QualityReview } from "../skills/generated/quality-reviewer.js";
import type { EditorialPlan } from "../skills/generated/editorial-strategist.js";
import type { PerformanceAnalysis } from "../skills/generated/performance-analyst.js";
import type { BenchmarkRecord } from "../skills/generated/benchmark-researcher.js";
import type { ErrorKind } from "../common/core.js";

export interface SkillOutputs {
  "polo-news-researcher": NewsEvent;
  "content-opportunity-detector": ContentOpportunity;
  "reel-planner": ReelPlan;
  "social-designer": SocialDesignPlan;
  copywriter: SocialCopy;
  "quality-reviewer": QualityReview;
  "editorial-strategist": EditorialPlan;
  "performance-analyst": PerformanceAnalysis;
  "benchmark-researcher": BenchmarkRecord;
}
export type SkillName = keyof SkillOutputs;
export const statuses = [
  "detected",
  "researching",
  "verified",
  "opportunity_created",
  "approved_for_production",
  "planning",
  "awaiting_assets",
  "blocked",
  "in_production",
  "ready_for_qa",
  "qa_failed",
  "ready_for_human_approval",
  "human_rejected",
  "human_approved",
  "ready_to_publish",
  "published",
  "measuring",
  "analyzed",
  "archived",
] as const;
export type Status = (typeof statuses)[number];
export type Rights =
  | "owned"
  | "licensed"
  | "permission_confirmed"
  | "platform_only"
  | "editorial_reference_only"
  | "rights_unknown"
  | "restricted";
export interface Versions {
  asset: number;
  copy: number;
  metadata: number;
  review: number;
}
export interface Revision<T> {
  version: number;
  data: T;
  at: string;
  inputHash: string;
  stale: boolean;
}
export interface Asset {
  id: string;
  type: "photo" | "video" | "audio" | "logo" | "graphic";
  stage?: "raw" | "approved" | "rendered" | "archive";
  storageRef: string;
  rights: Rights;
  required: boolean;
  source: string;
  credit: string | null;
  metadata: Record<string, unknown>;
  expiresAt?: string;
  allowedPlatforms?: string[];
}
export interface Blocker {
  code: string;
  owner: string;
  detail: string;
  at: string;
}
export interface Approval {
  id: string;
  state: "pending_approval" | "approved" | "rejected" | "changes_requested";
  approver: string | null;
  at: string;
  versions: Versions;
  packageHash: string;
  comment?: string;
  invalidatedAt?: string;
  invalidationReason?: string;
}
export interface Publication {
  id: string;
  provider: "mock";
  idempotencyKey: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalId: string | null;
  status: "pending" | "scheduled" | "published" | "cancelled" | "failed";
  versions: Versions;
  packageHash: string;
  payload: PublishPackage;
}
export interface PublishPackage {
  contentId: string;
  platform: string;
  versions: Versions;
  packageHash: string;
  copy: SocialCopy;
  assets: Asset[];
  metadata: Record<string, unknown>;
  simulated: true;
}
export interface PerformanceSnapshot {
  id: string;
  contentId: string;
  publicationId: string;
  observedAt: string;
  window: string;
  metrics: PerformanceAnalysis["metrics"];
  definitions: Record<string, string>;
  simulated: boolean;
}
export type Learning = PerformanceAnalysis["learnings"][number] & {
  contentId: string;
  evidence: string[];
  simulated: boolean;
  at: string;
};
export interface ContentItem {
  id: string;
  eventId: string;
  title: string;
  type: "single_image" | "reel" | "carousel" | "story";
  status: Status;
  objective: string;
  audienceJob: string;
  priority: string;
  opportunityScore: number | null;
  createdAt: string;
  updatedAt: string;
  versions: Versions;
  opportunity: ContentOpportunity | null;
  metadata: Revision<Record<string, unknown>>[];
  plans: Revision<ReelPlan | SocialDesignPlan>[];
  copies: Revision<SocialCopy>[];
  assets: Revision<Asset[]>[];
  reviews: Revision<QualityReview>[];
  approvals: Approval[];
  publications: Publication[];
  snapshots: PerformanceSnapshot[];
  blockers: Blocker[];
  reroutes: number;
}
export interface EventRecord {
  id: string;
  logicalKey: string;
  revision: number;
  data: NewsEvent;
  history: NewsEvent[];
  sourceKeys: string[];
  fingerprint: string;
}
export interface WorkflowRun {
  id: string;
  skill: SkillName;
  contentId: string | null;
  inputHash: string;
  knowledgeHash: string;
  input: unknown;
  output: unknown;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: "success" | "error";
  attempt: number;
  executor: string;
  model: string | null;
  configuration: unknown;
  error: { kind: ErrorKind; message: string } | null;
}
export interface AuditEvent {
  id: string;
  contentId: string | null;
  kind: string;
  from?: Status;
  to?: Status;
  at: string;
  detail: unknown;
}
export interface Store {
  revision: number;
  events: Record<string, EventRecord>;
  contents: Record<string, ContentItem>;
  runs: WorkflowRun[];
  audit: AuditEvent[];
  strategies: Revision<EditorialPlan>[];
  benchmarks: BenchmarkRecord[];
  learnings: Learning[];
}
export const emptyStore = (): Store => ({
  revision: 0,
  events: {},
  contents: {},
  runs: [],
  audit: [],
  strategies: [],
  benchmarks: [],
  learnings: [],
});
export function current<T>(revisions: Revision<T>[]): Revision<T> | undefined {
  return revisions.at(-1);
}
export function isReelPlan(
  plan: ReelPlan | SocialDesignPlan,
): plan is ReelPlan {
  return typeof plan.reel_id === "string" && Array.isArray(plan.footage);
}
