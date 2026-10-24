import importlib.util
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "validate_social_design.py"
spec = importlib.util.spec_from_file_location("validator", MODULE_PATH)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

def base_plan():
    return {
        "design_id": "design_1",
        "opportunity_id": "opp_1",
        "state": "ready_for_render",
        "strategy": {
            "design_job": "Communicate the final result instantly.",
            "primary_objective": "authority",
            "audience_job": "know who won and feel the match emotion",
            "success_signal": "shares and saves",
            "benchmark_mechanisms": []
        },
        "output": {
            "surface": "instagram_feed",
            "structure": "single_image",
            "aspect_intent": "portrait-first 4:5-safe",
            "slide_count": 1,
            "render_path": "canva",
            "template_relationship": "template_variant"
        },
        "assets": [{
            "asset_id": "photo_1",
            "path_or_url": "winner.jpg",
            "role": "hero authentic match photo",
            "rights_status": "owned",
            "required": True,
            "crop_notes": "keep rider and horse central",
            "credit": None
        }],
        "visual_system": {
            "concept": "Hero match image with compressed score band.",
            "primary_carrier": "authentic match photo",
            "hierarchy": ["winner/result", "team names", "tournament"],
            "type_roles": ["display score", "team names", "metadata"],
            "color_roles": ["brand base", "high contrast text", "single accent"],
            "brand_presence": "subtle Polo Connect mark",
            "photo_treatment": "natural contrast correction",
            "sponsor_treatment": None
        },
        "slides": [{
            "index": 1,
            "function": "result",
            "primary_message": "Team A 12 — Team B 10",
            "display_text": ["FINAL", "TEAM A 12", "TEAM B 10"],
            "asset_ids": ["photo_1"],
            "data": [],
            "layout_logic": "photo-dominant with result band"
        }],
        "accessibility": {
            "contrast_checked": True,
            "reading_order": "result, teams, tournament, brand",
            "alt_text": "Player on horseback celebrating after Team A wins 12-10.",
            "notes": None
        },
        "handoff": {
            "downstream_tool_or_skill": "canva",
            "must_preserve": ["final score", "team names", "authentic photo"],
            "renderer_freedom": ["spacing", "crop micro-adjustment"],
            "export_checks": ["verify current Instagram feed/API requirements"]
        },
        "observed_at": "2026-10-24T21:30:00-03:00"
    }

def test_valid_plan():
    assert validator.validate_design(base_plan()) == []

def test_unknown_required_rights_block_ready():
    p = base_plan()
    p["assets"][0]["rights_status"] = "rights_unknown"
    errors = validator.validate_design(p)
    assert any("unresolved required asset rights" in e for e in errors)

def test_slide_asset_must_exist():
    p = base_plan()
    p["slides"][0]["asset_ids"] = ["missing"]
    errors = validator.validate_design(p)
    assert any("unknown asset_id" in e for e in errors)

def test_ready_requires_contrast_check():
    p = base_plan()
    p["accessibility"]["contrast_checked"] = False
    errors = validator.validate_design(p)
    assert any("contrast_checked" in e for e in errors)

def test_carousel_requires_two_slides():
    p = base_plan()
    p["output"]["structure"] = "carousel"
    errors = validator.validate_design(p)
    assert any("carousel requires at least 2 slides" in e for e in errors)

def test_slide_count_matches_actual_slides():
    p = base_plan()
    p["output"]["slide_count"] = 2
    errors = validator.validate_design(p)
    assert any("slides length" in e for e in errors)

def test_synthetic_sports_reality_rejected():
    p = base_plan()
    p["assets"][0]["role"] = "AI-generated horse hero"
    errors = validator.validate_design(p)
    assert any("prohibited synthetic sports reality" in e for e in errors)

def test_ready_requires_handoff():
    p = base_plan()
    p["handoff"]["must_preserve"] = []
    errors = validator.validate_design(p)
    assert any("must_preserve" in e for e in errors)
