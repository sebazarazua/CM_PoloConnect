import importlib.util
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "validate_editorial_plan.py"
spec = importlib.util.spec_from_file_location("validator", MODULE_PATH)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

def base_plan():
    return {
        "plan_id": "plan_1",
        "planning_window": {
            "horizon": "weekly",
            "starts_at": "2026-10-26",
            "ends_at": "2026-11-01"
        },
        "audiences": [{
            "name": "existing polo fans",
            "priority": "primary",
            "need": "fast, credible coverage"
        }],
        "objectives": [{
            "objective": "increase qualified discovery",
            "primary_kpi": "non-follower reach",
            "confidence": "medium_confidence"
        }],
        "pillars": [{
            "name": "live competition",
            "audience_need": "experience decisive moments",
            "strategic_role": "core sports coverage",
            "current_emphasis": "core"
        }],
        "series": [],
        "calendar_policy": {
            "reactive_capacity_protected": True,
            "empty_days_allowed": True,
            "fixed_obligations": [],
            "saturation_warnings": []
        },
        "capacity": {
            "total_units": 20,
            "planned_units": 12,
            "reactive_reserved_units": 6
        },
        "experiments": [],
        "opportunity_detector_brief": {
            "current_objectives": ["qualified discovery"],
            "priority_audiences": ["existing polo fans"],
            "active_narratives": ["current tournament"]
        },
        "review": {
            "next_review_at": "2026-11-02",
            "review_scope": "weekly performance and editorial balance"
        },
        "observed_at": "2026-10-24T21:00:00-03:00"
    }

def test_valid_plan():
    assert validator.validate_plan(base_plan()) == []

def test_forces_empty_day_filler_invalid():
    p = base_plan()
    p["calendar_policy"]["empty_days_allowed"] = False
    errors = validator.validate_plan(p)
    assert any("empty_days_allowed" in e for e in errors)

def test_capacity_cannot_overbook():
    p = base_plan()
    p["capacity"]["planned_units"] = 18
    p["capacity"]["reactive_reserved_units"] = 5
    errors = validator.validate_plan(p)
    assert any("cannot exceed" in e for e in errors)

def test_reactive_capacity_required():
    p = base_plan()
    p["capacity"]["reactive_reserved_units"] = 0
    errors = validator.validate_plan(p)
    assert any("reactive capacity" in e for e in errors)

def test_too_many_objectives_invalid():
    p = base_plan()
    p["objectives"] = [
        {"objective": f"obj{i}", "primary_kpi": f"kpi{i}", "confidence": "experimental"}
        for i in range(5)
    ]
    errors = validator.validate_plan(p)
    assert any("too many primary objectives" in e for e in errors)

def test_rigid_format_quota_invalid():
    p = base_plan()
    p["reels_percentage"] = 60
    errors = validator.validate_plan(p)
    assert any("forbidden rigid strategy field" in e for e in errors)

def test_pillar_needs_audience_need():
    p = base_plan()
    p["pillars"][0]["audience_need"] = ""
    errors = validator.validate_plan(p)
    assert any("requires audience_need" in e for e in errors)
