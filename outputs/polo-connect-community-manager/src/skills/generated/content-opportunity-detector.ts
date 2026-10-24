/* Generated from the original skill JSON Schema. npm run skills:types */

export interface ContentOpportunity {
  opportunity_id: string;
  source_candidates: {
    source_type: string;
    source_id: string;
    [k: string]: unknown;
  }[];
  eligibility: {
    eligible: boolean;
    blockers: string[];
    [k: string]: unknown;
  };
  strategy: {
    primary_objective: string;
    secondary_objectives?: string[];
    audience_job: string;
    editorial_angle: string;
    why_now: string;
    why_polo_connect: string;
    benchmark_mechanisms?: string[];
    [k: string]: unknown;
  };
  timing: {
    timing_class:
      "live" | "reactive" | "same_day" | "scheduled" | "evergreen" | "seasonal";
    earliest_publish_at?: string | null;
    latest_publish_at?: string | null;
    expires_at?: string | null;
    [k: string]: unknown;
  };
  format: {
    preferred: string;
    fallback?: string | null;
    reason: string;
    [k: string]: unknown;
  };
  assets: {
    readiness:
      | "ready"
      | "ready_with_light_work"
      | "capture_required"
      | "data_required"
      | "permission_required"
      | "missing_critical_asset";
    production_complexity: "low" | "medium" | "high";
    required_assets: string[];
    rights_notes?: string | null;
    [k: string]: unknown;
  };
  decision: {
    state:
      | "produce_now"
      | "produce_scheduled"
      | "merge"
      | "story_only"
      | "monitor"
      | "hold"
      | "blocked_verification"
      | "blocked_assets"
      | "reject";
    priority: "P0" | "P1" | "P2" | "P3" | "P4";
    opportunity_score: number | null;
    merge_with?: string | null;
    reason?: string | null;
    [k: string]: unknown;
  };
  handoff: {
    downstream_skill: string | null;
    required_facts: string[];
    constraints?: string[];
    success_signal: string;
    learning_hypothesis?: string | null;
    [k: string]: unknown;
  };
  observed_at: string;
  [k: string]: unknown;
}
