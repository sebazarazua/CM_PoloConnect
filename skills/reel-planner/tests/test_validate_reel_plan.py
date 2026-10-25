import importlib.util
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "validate_reel_plan.py"
spec = importlib.util.spec_from_file_location("validator", MODULE_PATH)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

def base_plan():
    return {
        "reel_id": "reel_1",
        "opportunity_id": "opp_1",
        "state": "ready_for_edit",
        "strategy": {
            "reel_job": "Make the decisive goal feel immediate.",
            "primary_objective": "reach",
            "audience_job": "experience the match-winning moment",
            "success_signal": "3-second retention and shares",
            "target_duration_seconds": {"min": 10, "max": 18}
        },
        "rights": {
            "video_status": "owned",
            "audio_status": "owned"
        },
        "footage": [{
            "source_id": "clip_goal",
            "source_path": "match.mp4",
            "in_timecode": "00:12:10.000",
            "out_timecode": "00:12:18.000",
            "description": "Decisive goal from owned broadcast.",
            "role": "primary_moment",
            "selection_status": "must_use",
            "rights_status": "owned",
            "audio_value": "commentary and crowd"
        }],
        "hook": {
            "type": "peak_action",
            "description": "Open directly on the attack.",
            "source_id": "clip_goal",
            "alternative_hypotheses": []
        },
        "narrative": {
            "architecture": "peak -> result -> replay -> reaction",
            "beats": [{
                "start_s": 0,
                "end_s": 5,
                "function": "hook/payoff",
                "visual": "decisive attack",
                "source_id": "clip_goal",
                "overlay": None,
                "audio": "preserve commentary",
                "required": True
            }]
        },
        "text": {
            "overlays": ["FINAL: 12-11"],
            "subtitles_required": False,
            "subtitle_source": None,
            "accessibility_notes": None
        },
        "audio": {
            "mode": "commentary_led",
            "preserve_source_audio": True,
            "music_brief": None,
            "voiceover_brief": None,
            "rights_notes": "owned broadcast audio"
        },
        "cover": {
            "strategy": "hero action frame with result",
            "source_frame": "clip_goal@00:12:15",
            "headline": "EL GOL DEL TÍTULO",
            "crop_notes": "keep rider and ball central",
            "brand_notes": "subtle Polo Connect mark"
        },
        "handoff": {
            "downstream_skill": "reel-editor",
            "deadline": None,
            "must_preserve": ["final score", "decisive goal sequence"],
            "editor_freedom": ["micro cut timing", "audio mix"],
            "export_checks": ["verify current Instagram Reel technical requirements"]
        },
        "observed_at": "2026-10-24T21:00:00-03:00"
    }

def test_valid_plan():
    assert validator.validate_reel_plan(base_plan()) == []

def test_ready_requires_must_use_clip():
    p = base_plan()
    p["footage"][0]["selection_status"] = "optional"
    errors = validator.validate_reel_plan(p)
    assert any("must_use" in e for e in errors)

def test_unknown_rights_block_ready():
    p = base_plan()
    p["rights"]["audio_status"] = "rights_unknown"
    errors = validator.validate_reel_plan(p)
    assert any("audio_status" in e for e in errors)

def test_hook_source_must_exist():
    p = base_plan()
    p["hook"]["source_id"] = "missing"
    errors = validator.validate_reel_plan(p)
    assert any("hook.source_id" in e for e in errors)

def test_beats_must_have_positive_duration():
    p = base_plan()
    p["narrative"]["beats"][0]["end_s"] = 0
    errors = validator.validate_reel_plan(p)
    assert any("greater than start_s" in e for e in errors)

def test_synthetic_match_footage_rejected():
    p = base_plan()
    p["footage"][0]["description"] = "AI-generated player synthetic match footage"
    errors = validator.validate_reel_plan(p)
    assert any("prohibited synthetic" in e for e in errors)

def test_ready_requires_handoff_constraints():
    p = base_plan()
    p["handoff"]["must_preserve"] = []
    errors = validator.validate_reel_plan(p)
    assert any("must_preserve" in e for e in errors)
