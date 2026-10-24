/* Generated from the original skill JSON Schema. npm run skills:types */

export interface NewsEvent {
  event_id: string;
  event_type: string;
  headline_working: string;
  entities: {
    type: string;
    canonical_name: string;
    aliases?: string[];
    source_id?: string | null;
    [k: string]: unknown;
  }[];
  time: {
    event_started_at?: string | null;
    event_ended_at?: string | null;
    scheduled_for?: string | null;
    announced_at?: string | null;
    published_at?: string | null;
    updated_at?: string | null;
    [k: string]: unknown;
  };
  claims: {
    claim: string;
    status:
      | "confirmed_primary"
      | "confirmed_multi_source"
      | "reported_single_source"
      | "participant_claim"
      | "rumor"
      | "disputed"
      | "false_or_corrected"
      | "unknown";
    confidence: "high" | "medium" | "low";
    source_ids: string[];
    notes?: string | null;
    [k: string]: unknown;
  }[];
  sources: {
    source_id: string;
    url: string;
    role: string;
    publisher?: string | null;
    published_at?: string | null;
    updated_at?: string | null;
    observed_at: string;
    original_reporting?: boolean | null;
    derived_from?: string[];
    [k: string]: unknown;
  }[];
  editorial: {
    action_state:
      "publish_now" | "prepare" | "monitor" | "background_only" | "reject";
    urgency:
      | "immediate"
      | "same_day"
      | "next_24h"
      | "scheduled"
      | "evergreen"
      | "no_action";
    editorial_score: number | null;
    why_it_matters: string;
    angles?: string[];
    follow_up_trigger?: string | null;
    [k: string]: unknown;
  };
  rights: {
    media_status:
      | "owned"
      | "licensed"
      | "permission_confirmed"
      | "platform_embed_only"
      | "editorial_reference_only"
      | "rights_unknown"
      | "restricted";
    credit_required?: boolean | null;
    credit_text?: string | null;
    notes?: string | null;
    [k: string]: unknown;
  };
  observed_at: string;
  [k: string]: unknown;
}
