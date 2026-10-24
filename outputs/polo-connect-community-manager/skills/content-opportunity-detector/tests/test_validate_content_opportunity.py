import importlib.util
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "validate_content_opportunity.py"
spec = importlib.util.spec_from_file_location("validator", MODULE_PATH)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

def base_record():
    return {
        "opportunity_id": "opp_1",
        "source_candidates": [{"source_type": "news_event", "source_id": "evt_1"}],
        "eligibility": {"eligible": True, "blockers": []},
        "strategy": {
            "primary_objective": "reach",
            "audience_job": "deliver a decisive match moment",
            "editorial_angle": "Lead with the decisive goal using owned footage.",
            "why_now": "The match just ended.",
            "why_polo_connect": "Polo Connect owns the broadcast footage."
        },
        "timing": {
            "timing_class": "reactive",
            "earliest_publish_at": None,
            "latest_publish_at": None,
            "expires_at": None
        },
        "format": {
            "preferred": "reel",
            "fallback": "story",
            "reason": "The footage carries the story."
        },
        "assets": {
            "readiness": "ready",
            "production_complexity": "low",
            "required_assets": ["owned broadcast clip"]
        },
        "decision": {
            "state": "produce_now",
            "priority": "P1",
            "opportunity_score": 88,
            "merge_with": None,
            "reason": "High-value owned moment."
        },
        "handoff": {
            "downstream_skill": "reel-planner",
            "required_facts": ["final score"],
            "constraints": [],
            "success_signal": "3-second hold and shares",
            "learning_hypothesis": "Immediate peak action will outperform title intros."
        },
        "observed_at": "2026-10-24T20:00:00-03:00"
    }

def test_valid_record():
    assert validator.validate_opportunity(base_record()) == []

def test_produce_now_cannot_have_blocker():
    r = base_record()
    r["eligibility"]["eligible"] = False
    r["eligibility"]["blockers"] = ["unverified_fact"]
    errors = validator.validate_opportunity(r)
    assert any("requires eligibility" in e for e in errors)

def test_produce_now_cannot_require_permission():
    r = base_record()
    r["assets"]["readiness"] = "permission_required"
    errors = validator.validate_opportunity(r)
    assert any("incompatible" in e for e in errors)

def test_merge_requires_target():
    r = base_record()
    r["decision"]["state"] = "merge"
    r["decision"]["merge_with"] = None
    errors = validator.validate_opportunity(r)
    assert any("merge requires" in e for e in errors)

def test_blocked_assets_requires_unresolved_asset():
    r = base_record()
    r["decision"]["state"] = "blocked_assets"
    r["assets"]["readiness"] = "ready"
    errors = validator.validate_opportunity(r)
    assert any("blocked_assets requires" in e for e in errors)

def test_approved_requires_downstream_skill():
    r = base_record()
    r["handoff"]["downstream_skill"] = None
    errors = validator.validate_opportunity(r)
    assert any("downstream_skill" in e for e in errors)
