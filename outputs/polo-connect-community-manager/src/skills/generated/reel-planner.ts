/* Generated from the original skill JSON Schema. npm run skills:types */

export interface ReelPlan {
  reel_id: string;
  opportunity_id: string;
  state:
    | "ready_for_edit"
    | "ready_with_capture_request"
    | "blocked_assets"
    | "blocked_verification"
    | "blocked_rights"
    | "replan_required";
  strategy: {
    reel_job: string;
    primary_objective: string;
    audience_job: string;
    success_signal: string;
    target_duration_seconds?: {
      min: number;
      max: number;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  };
  rights: {
    video_status: string;
    audio_status: string;
    notes?: string | null;
    [k: string]: unknown;
  };
  footage: {
    source_id: string;
    source_path?: string | null;
    in_timecode?: string | null;
    out_timecode?: string | null;
    description?: string | null;
    role: string;
    selection_status:
      "must_use" | "strong_option" | "context_only" | "optional" | "avoid";
    rights_status: string;
    audio_value?: string | null;
    [k: string]: unknown;
  }[];
  hook: {
    type: string;
    description: string;
    source_id?: string | null;
    alternative_hypotheses?: string[];
    [k: string]: unknown;
  };
  narrative: {
    architecture: string;
    beats: {
      start_s: number;
      end_s: number;
      function: string;
      visual: string;
      source_id?: string | null;
      overlay?: string | null;
      audio?: string | null;
      required?: boolean;
      [k: string]: unknown;
    }[];
    [k: string]: unknown;
  };
  text: {
    overlays: string[];
    subtitles_required: boolean;
    subtitle_source?: string | null;
    accessibility_notes?: string | null;
    [k: string]: unknown;
  };
  audio: {
    mode:
      | "natural_sound_led"
      | "commentary_led"
      | "music_led"
      | "voiceover_led"
      | "hybrid";
    preserve_source_audio: boolean;
    music_brief?: string | null;
    voiceover_brief?: string | null;
    rights_notes?: string | null;
    [k: string]: unknown;
  };
  cover: {
    strategy: string;
    source_frame: string;
    headline?: string | null;
    crop_notes?: string | null;
    brand_notes?: string | null;
    [k: string]: unknown;
  };
  handoff: {
    downstream_skill: string;
    deadline: string | null;
    must_preserve: string[];
    editor_freedom?: string[];
    export_checks?: string[];
    [k: string]: unknown;
  };
  observed_at: string;
  [k: string]: unknown;
}
