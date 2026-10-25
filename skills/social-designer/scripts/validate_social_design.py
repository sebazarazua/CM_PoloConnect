#!/usr/bin/env python3
import json
import sys
from pathlib import Path

STATES = {
    "ready_for_render", "ready_with_asset_request", "blocked_assets",
    "blocked_verification", "blocked_rights", "brand_system_required",
    "replan_required"
}
STRUCTURES = {
    "single_image", "carousel", "story", "story_sequence",
    "graphic_frame_for_reel", "cover", "multi_surface_system"
}
RENDER_PATHS = {
    "canva", "adobe", "figma", "html_canvas", "image_renderer",
    "manual_designer", "existing_template_engine", "other"
}

def validate_design(record):
    errors = []

    required = [
        "design_id", "opportunity_id", "state", "strategy", "output",
        "assets", "visual_system", "slides", "accessibility",
        "handoff", "observed_at"
    ]
    for key in required:
        if key not in record:
            errors.append(f"missing required top-level key: {key}")

    state = record.get("state")
    if state not in STATES:
        errors.append(f"invalid state: {state}")

    strategy = record.get("strategy", {})
    for key in ("design_job", "primary_objective", "audience_job", "success_signal"):
        if not strategy.get(key):
            errors.append(f"strategy.{key} required")

    output = record.get("output", {})
    structure = output.get("structure")
    if structure not in STRUCTURES:
        errors.append("invalid output.structure")
    if output.get("render_path") not in RENDER_PATHS:
        errors.append("invalid output.render_path")
    slide_count = output.get("slide_count")
    if not isinstance(slide_count, int) or slide_count < 1:
        errors.append("output.slide_count must be >= 1")

    slides = record.get("slides", [])
    if isinstance(slide_count, int) and len(slides) != slide_count:
        errors.append("slides length must equal output.slide_count")

    indices = [s.get("index") for s in slides]
    if indices and indices != list(range(1, len(slides) + 1)):
        errors.append("slides must be sequentially indexed from 1")

    asset_ids = {a.get("asset_id") for a in record.get("assets", []) if a.get("asset_id")}
    critical_unknown_rights = []
    for i, asset in enumerate(record.get("assets", [])):
        if not asset.get("asset_id"):
            errors.append(f"assets[{i}] missing asset_id")
        if not asset.get("role"):
            errors.append(f"assets[{i}] missing role")
        rights = asset.get("rights_status")
        if not rights:
            errors.append(f"assets[{i}] missing rights_status")
        if asset.get("required") is True and rights in {"rights_unknown", "restricted", None, ""}:
            critical_unknown_rights.append(asset.get("asset_id", str(i)))

    if state == "ready_for_render" and critical_unknown_rights:
        errors.append(f"ready_for_render has unresolved required asset rights: {critical_unknown_rights}")

    for i, slide in enumerate(slides):
        for asset_id in slide.get("asset_ids", []):
            if asset_id not in asset_ids:
                errors.append(f"slides[{i}] references unknown asset_id: {asset_id}")
        for key in ("function", "primary_message", "layout_logic"):
            if not slide.get(key):
                errors.append(f"slides[{i}].{key} required")

    visual = record.get("visual_system", {})
    for key in ("concept", "primary_carrier", "hierarchy", "type_roles", "color_roles", "brand_presence"):
        value = visual.get(key)
        if value is None or value == "" or value == []:
            errors.append(f"visual_system.{key} required")

    access = record.get("accessibility", {})
    if state == "ready_for_render" and access.get("contrast_checked") is not True:
        errors.append("ready_for_render requires accessibility.contrast_checked=true")
    if not access.get("reading_order"):
        errors.append("accessibility.reading_order required")

    handoff = record.get("handoff", {})
    if state == "ready_for_render":
        if not handoff.get("downstream_tool_or_skill"):
            errors.append("ready_for_render requires downstream_tool_or_skill")
        if not handoff.get("must_preserve"):
            errors.append("ready_for_render requires must_preserve")
        if not handoff.get("export_checks"):
            errors.append("ready_for_render requires export_checks")

    # Reject common fabricated-reality markers in asset descriptions/roles.
    prohibited = ("ai-generated player", "ai-generated horse", "synthetic stadium",
                  "fake crowd", "generated match photo")
    for i, asset in enumerate(record.get("assets", [])):
        blob = " ".join(str(asset.get(k, "")) for k in ("role", "path_or_url", "crop_notes")).lower()
        if any(term in blob for term in prohibited):
            errors.append(f"assets[{i}] contains prohibited synthetic sports reality")

    # Carousel must have at least two slides; single-image formats should not be mislabeled.
    if structure == "carousel" and isinstance(slide_count, int) and slide_count < 2:
        errors.append("carousel requires at least 2 slides")

    return errors

def main():
    if len(sys.argv) != 2:
        print("usage: validate_social_design.py <plan.json>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    record = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_design(record)

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("OK")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
