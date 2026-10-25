/* Generated from the original skill JSON Schema. npm run skills:types */

export interface PerformanceAnalysis {
  analysis_id: string;
  scope: {
    analysis_type:
      | "post"
      | "series"
      | "experiment"
      | "tournament"
      | "campaign"
      | "monthly"
      | "strategy";
    content_ids: string[];
    window: string;
    objective?: string | null;
    [k: string]: unknown;
  };
  questions: string[];
  data_quality: {
    status: "high" | "medium" | "low" | "insufficient";
    limitations: string[];
    sources?: string[];
    [k: string]: unknown;
  };
  metrics: {
    metric_id: string;
    name: string;
    value: unknown;
    source: string;
    observed_at: string;
    window?: string | null;
    denominator?: string | null;
    organic_paid_scope?: string | null;
    definition_version?: string | null;
    availability_status:
      | "available"
      | "not_available"
      | "not_authorized"
      | "not_applicable"
      | "not_captured"
      | "definition_changed";
    [k: string]: unknown;
  }[];
  baselines: {
    baseline_id: string;
    description: string;
    sample_size: number;
    comparison_quality: "high" | "medium" | "low";
    median_values?: {
      [k: string]: unknown;
    };
    exclusions?: string[];
    [k: string]: unknown;
  }[];
  results: {
    statement: string;
    evidence_ids: string[];
    effect?: string | null;
    [k: string]: unknown;
  }[];
  diagnoses: {
    hypothesis: string;
    confidence: "high" | "medium" | "low";
    confounders: string[];
    evidence_ids?: string[];
    causal_claim?: boolean;
    [k: string]: unknown;
  }[];
  learnings: {
    learning_id: string;
    statement: string;
    maturity:
      | "external_hypothesis"
      | "internal_observation"
      | "repeated_internal_signal"
      | "validated_internal_pattern"
      | "strategic_rule_candidate";
    confidence: "high" | "medium" | "low";
    scope: string;
    sample_size?: number | null;
    next_test?: string | null;
    [k: string]: unknown;
  }[];
  actions: {
    action:
      | "continue"
      | "increase"
      | "decrease"
      | "iterate"
      | "pause"
      | "retire"
      | "test_again"
      | "needs_more_data";
    reason: string;
    owner: string;
    [k: string]: unknown;
  }[];
  handoffs: {
    target_skill: string;
    finding: string;
    confidence: "high" | "medium" | "low";
    scope: string;
    do_not_generalize?: string | null;
    next_validation?: string | null;
    [k: string]: unknown;
  }[];
  observed_at: string;
  [k: string]: unknown;
}
