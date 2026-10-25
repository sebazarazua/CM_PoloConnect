/* Generated from the original skill JSON Schema. npm run skills:types */

export interface BenchmarkRecord {
  account: {
    submitted_handle: string;
    canonical_handle: string | null;
    verification_status:
      | "verified"
      | "unverified"
      | "renamed"
      | "duplicate"
      | "unavailable"
      | "unofficial";
    tags?: string[];
    [k: string]: unknown;
  };
  content: {
    platform: string;
    url?: string | null;
    content_id?: string | null;
    published_at?: string | null;
    format: string;
    topic?: string | null;
    event_context?: string | null;
    [k: string]: unknown;
  };
  evidence: {
    observations: {
      [k: string]: unknown;
    }[];
    metrics: {
      name: string;
      value: unknown;
      evidence_level: "E1" | "E2" | "E3" | "E4" | "E5";
      source: string;
      formula?: string | null;
      observed_at?: string | null;
      [k: string]: unknown;
    }[];
    [k: string]: unknown;
  };
  analysis: {
    mechanisms: string[];
    interpretations?: string[];
    confidence: "high" | "medium" | "low";
    pattern_status:
      | "single_example"
      | "repeated_account_pattern"
      | "cross_account_pattern"
      | "platform_pattern"
      | "polo_connect_validated";
    utility_score?: number | null;
    performance_signal?:
      | "strong_relative_signal"
      | "positive_relative_signal"
      | "baseline_or_unclear"
      | "weak_relative_signal"
      | "insufficient_data";
    [k: string]: unknown;
  };
  transfer: {
    principle: string;
    polo_connect_application: string;
    production_requirements?: string[];
    risks?: string[];
    test_hypothesis?: string | null;
    originality_check: {
      passes: boolean;
      notes: string;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  };
  observed_at: string;
  [k: string]: unknown;
}
