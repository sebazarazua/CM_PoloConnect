/* Generated from the original skill JSON Schema. npm run skills:types */

export interface QualityReview {
  review_id: string;
  content_id: string;
  review_stage: "pre_render" | "post_render" | "pre_publish";
  review_mode: "full" | "partial" | "delta";
  decision:
    | "pass_for_human_approval"
    | "pass_for_publish"
    | "changes_required"
    | "blocked_verification"
    | "blocked_rights"
    | "blocked_compliance"
    | "blocked_technical"
    | "replan_required"
    | "reject";
  scope: {
    surfaces_reviewed: string[];
    available_inputs: string[];
    missing_inputs: string[];
    publishing_route?: string | null;
    [k: string]: unknown;
  };
  versions: {
    asset_version?: string | null;
    copy_version?: string | null;
    metadata_version?: string | null;
    [k: string]: unknown;
  };
  source_of_truth: {
    fact_id: string;
    fact: string;
    status: string;
    source_id?: string | null;
    [k: string]: unknown;
  }[];
  issues: {
    issue_id: string;
    severity: "blocker" | "major" | "minor" | "note";
    category: string;
    surface: string;
    evidence?: string | null;
    problem: string;
    impact: string;
    owner: string;
    required_fix: string;
    recheck_scope: string[];
    status:
      "open" | "fixed_pending_recheck" | "closed" | "accepted_non_material";
    [k: string]: unknown;
  }[];
  checks: {
    facts: string;
    editorial_alignment: string;
    copy: string;
    visual_or_video: string;
    authenticity: string;
    originality: string;
    rights: string;
    sponsor_compliance: string;
    accessibility: string;
    platform_preflight: string;
    timing: string;
    brand_integrity: string;
    [k: string]: unknown;
  };
  approval: {
    state:
      "not_required" | "required_pending" | "approved" | "reapproval_required";
    approver?: string | null;
    approved_at?: string | null;
    [k: string]: unknown;
  };
  observed_at: string;
  [k: string]: unknown;
}
