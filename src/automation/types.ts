import type { Asset, SkillOutputs, Versions } from "../domain/models.js";
export type AutomationMode = "manual" | "supervised" | "automatic";
export type PolicyVerdict =
  "auto_publish" | "needs_human_approval" | "hold" | "reject";
export interface PublicationTiming {
  mode: "publish_now" | "scheduled_at" | "hold_until";
  at?: string;
}
export interface ContentCandidate {
  id: string;
  logicalKey: string;
  event: SkillOutputs["polo-news-researcher"];
  assets: Asset[];
  verifiedBy: string;
  consent: {
    allowAutomatic: boolean;
    risk: "routine" | "sensitive" | "opinion" | "ambiguous" | "unknown";
    productionApprovedBy?: string;
  };
  timing: PublicationTiming;
}
export interface CandidateRecord {
  key: string;
  candidate: ContentCandidate;
  source: string;
  contentId?: string;
  eventId?: string;
  createdAt: string;
  updatedAt: string;
  verdict?: PolicyVerdict;
  reason?: string[];
  lastPackageHash?: string;
  lastCycleId?: string;
}
export interface PolicyDecision {
  id: string;
  version: "1";
  contentId: string;
  accountId: string;
  packageHash: string;
  versions: Versions;
  verdict: PolicyVerdict;
  reason: string[];
  evaluatedAt: string;
  configHash: string;
}
export interface PolicyApproval {
  id: string;
  decisionId: string;
  accountId: string;
  packageHash: string;
  versions: Versions;
  at: string;
  expiresAt: string;
  policyConfigHash: string;
}
export interface CycleEntry {
  candidateKey: string;
  contentId?: string;
  content?: {
    id: string;
    eventId: string;
    title: string;
    status: string;
    versions: Versions;
  };
  verdict: PolicyVerdict;
  reason: string[];
  would_publish: boolean;
  caption?: string;
  asset?: string;
  target: string | null;
  simulated: boolean;
  publicationId?: string;
  error?: string;
}
export interface AutomationCycle {
  id: string;
  startedAt: string;
  endedAt: string | null;
  mode: AutomationMode;
  dryRun: boolean;
  simulated: boolean;
  status: "running" | "completed" | "failed" | "interrupted";
  counters: Record<
    | "discovered"
    | "generated"
    | "skipped"
    | "duplicate"
    | "held"
    | "approval_required"
    | "auto_approved_by_policy"
    | "published"
    | "failed",
    number
  >;
  entries: CycleEntry[];
  error?: string;
  llmCalls: number;
  costUsd: number;
}
export interface DryRunMediaRecord {
  packageHash: string;
  containerId: string;
  hosted: import("../integrations/instagram/hosting.js").HostedMedia;
  preparedAt: string;
  cleanedAt?: string;
}
export interface AutomationState {
  queue: ContentCandidate[];
  candidates: Record<string, CandidateRecord>;
  cycles: AutomationCycle[];
  policyApprovals: Record<string, PolicyApproval[]>;
  dryRunMedia: Record<string, DryRunMediaRecord>;
  lease?: { owner: string; expiresAt: string };
}
export function emptyAutomation(): AutomationState {
  return {
    queue: [],
    candidates: {},
    cycles: [],
    policyApprovals: {},
    dryRunMedia: {},
  };
}
