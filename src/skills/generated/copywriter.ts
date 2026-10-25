/* Generated from the original skill JSON Schema. npm run skills:types */

export interface SocialCopy {
  copy_id: string;
  opportunity_id: string;
  state:
    | "ready_for_approval"
    | "ready_for_publish"
    | "blocked_verification"
    | "blocked_required_input"
    | "replan_required";
  language: string;
  tone_mode: string;
  copy_job: string;
  source_facts: {
    fact_id: string;
    fact: string;
    verification_status: string;
    source_id?: string | null;
    [k: string]: unknown;
  }[];
  outputs: {
    caption?: string | null;
    headline?: string | null;
    subheadline?: string | null;
    overlays?: string[];
    slide_copy?: {
      index: number;
      text: string[];
      [k: string]: unknown;
    }[];
    story_frames?: {
      index: number;
      text: string[];
      interaction_prompt?: string | null;
      [k: string]: unknown;
    }[];
    cta?: string | null;
    hashtags?: string[];
    mentions?: string[];
    alt_text_draft?: string | null;
    [k: string]: unknown;
  };
  qa: {
    facts_checked: boolean;
    anti_ai_checked: boolean;
    originality_checked: boolean;
    tone_checked: boolean;
    asset_consistency_checked: boolean;
    notes?: string | null;
    [k: string]: unknown;
  };
  observed_at: string;
  [k: string]: unknown;
}
