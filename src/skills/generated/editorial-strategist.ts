/* Generated from the original skill JSON Schema. npm run skills:types */

export interface EditorialPlan {
  plan_id: string;
  planning_window: {
    horizon: "seasonal" | "tournament" | "monthly" | "weekly";
    starts_at: string;
    ends_at: string;
    [k: string]: unknown;
  };
  audiences: {
    name: string;
    priority: "primary" | "secondary" | "opportunistic";
    need: string;
    desired_behavior?: string | null;
    [k: string]: unknown;
  }[];
  objectives: {
    objective: string;
    primary_kpi: string;
    diagnostic_metrics?: string[];
    target?: unknown;
    confidence?: "high_confidence" | "medium_confidence" | "experimental";
    [k: string]: unknown;
  }[];
  pillars: {
    name: string;
    audience_need: string;
    strategic_role: string;
    polo_connect_advantage?: string | null;
    current_emphasis: "core" | "supporting" | "opportunistic" | "reduced";
    anti_pattern?: string | null;
    [k: string]: unknown;
  }[];
  series: {
    name: string;
    purpose: string;
    status: "active" | "test" | "paused" | "retired";
    trigger_or_cadence?: string | null;
    success_signal?: string | null;
    retirement_rule?: string | null;
    [k: string]: unknown;
  }[];
  calendar_policy: {
    reactive_capacity_protected: boolean;
    empty_days_allowed: boolean;
    fixed_obligations?: string[];
    saturation_warnings?: string[];
    [k: string]: unknown;
  };
  capacity: {
    total_units: number;
    planned_units: number;
    reactive_reserved_units: number;
    notes?: string | null;
    [k: string]: unknown;
  };
  experiments: {
    hypothesis: string;
    variable: string;
    baseline?: string | null;
    success_signal: string;
    evaluation_window?: string | null;
    [k: string]: unknown;
  }[];
  opportunity_detector_brief: {
    current_objectives: string[];
    priority_audiences: string[];
    active_narratives: string[];
    reduce_or_avoid?: string[];
    reactive_notes?: string | null;
    [k: string]: unknown;
  };
  review: {
    next_review_at: string;
    review_scope: string;
    [k: string]: unknown;
  };
  observed_at: string;
  [k: string]: unknown;
}
