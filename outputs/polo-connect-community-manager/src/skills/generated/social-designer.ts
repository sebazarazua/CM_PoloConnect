/* Generated from the original skill JSON Schema. npm run skills:types */

export interface SocialDesignPlan {
  design_id: string;
  opportunity_id: string;
  state:
    | "ready_for_render"
    | "ready_with_asset_request"
    | "blocked_assets"
    | "blocked_verification"
    | "blocked_rights"
    | "brand_system_required"
    | "replan_required";
  strategy: {
    design_job: string;
    primary_objective: string;
    audience_job: string;
    success_signal: string;
    benchmark_mechanisms?: string[];
    [k: string]: unknown;
  };
  output: {
    surface: string;
    structure:
      | "single_image"
      | "carousel"
      | "story"
      | "story_sequence"
      | "graphic_frame_for_reel"
      | "cover"
      | "multi_surface_system";
    aspect_intent: string;
    slide_count: number;
    render_path:
      | "canva"
      | "adobe"
      | "figma"
      | "html_canvas"
      | "image_renderer"
      | "manual_designer"
      | "existing_template_engine"
      | "other";
    template_relationship?:
      | "existing_template"
      | "template_variant"
      | "new_reusable_system"
      | "bespoke_editorial";
    [k: string]: unknown;
  };
  assets: {
    asset_id: string;
    path_or_url?: string | null;
    role: string;
    rights_status: string;
    required: boolean;
    crop_notes?: string | null;
    credit?: string | null;
    [k: string]: unknown;
  }[];
  visual_system: {
    concept: string;
    primary_carrier: string;
    hierarchy: string[];
    type_roles: string[];
    color_roles: string[];
    brand_presence: string;
    photo_treatment?: string | null;
    sponsor_treatment?: string | null;
    [k: string]: unknown;
  };
  slides: {
    index: number;
    function: string;
    primary_message: string;
    display_text?: string[];
    asset_ids?: string[];
    data?: {
      [k: string]: unknown;
    }[];
    layout_logic: string;
    continuity_note?: string | null;
    [k: string]: unknown;
  }[];
  accessibility: {
    contrast_checked: boolean;
    reading_order: string;
    alt_text: string | null;
    notes?: string | null;
    [k: string]: unknown;
  };
  handoff: {
    downstream_tool_or_skill: string;
    must_preserve: string[];
    renderer_freedom?: string[];
    export_checks: string[];
    [k: string]: unknown;
  };
  observed_at: string;
  [k: string]: unknown;
}
