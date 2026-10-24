import importlib.util
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "validate_quality_review.py"
spec = importlib.util.spec_from_file_location("validator", MODULE_PATH)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

def base_review():
    return {
        "review_id": "qr_1",
        "content_id": "content_1",
        "review_stage": "pre_publish",
        "review_mode": "full",
        "decision": "pass_for_publish",
        "scope": {
            "surfaces_reviewed": ["feed image", "caption"],
            "available_inputs": ["rendered asset", "copy", "facts", "rights"],
            "missing_inputs": [],
            "publishing_route": "metricool"
        },
        "versions": {
            "asset_version": "v3",
            "copy_version": "v2",
            "metadata_version": "v1"
        },
        "source_of_truth": [{
            "fact_id": "f1",
            "fact": "Team A won 12-10.",
            "status": "confirmed_primary",
            "source_id": "evt_1"
        }],
        "issues": [],
        "checks": {
            "facts": "pass",
            "editorial_alignment": "pass",
            "copy": "pass",
            "visual_or_video": "pass",
            "authenticity": "pass",
            "originality": "pass",
            "rights": "pass",
            "sponsor_compliance": "pass",
            "accessibility": "pass",
            "platform_preflight": "pass",
            "timing": "pass",
            "brand_integrity": "pass"
        },
        "approval": {
            "state": "approved",
            "approver": "human",
            "approved_at": "2026-10-24T22:00:00-03:00"
        },
        "observed_at": "2026-10-24T22:05:00-03:00"
    }

def test_valid_review():
    assert validator.validate_review(base_review()) == []

def test_open_blocker_prevents_pass():
    r = base_review()
    r["issues"] = [{
        "issue_id": "i1",
        "severity": "blocker",
        "category": "facts",
        "surface": "caption",
        "evidence": "caption 12-11 vs source 12-10",
        "problem": "Wrong score",
        "impact": "Publishes false result",
        "owner": "copywriter",
        "required_fix": "Change caption score to 12-10",
        "recheck_scope": ["caption", "visual", "alt text"],
        "status": "open"
    }]
    errors = validator.validate_review(r)
    assert any("open blockers" in e for e in errors)

def test_open_major_prevents_pass():
    r = base_review()
    r["issues"] = [{
        "issue_id": "i1",
        "severity": "major",
        "category": "readability",
        "surface": "graphic",
        "evidence": "score unreadable at mobile size",
        "problem": "Primary result is not readable",
        "impact": "Core message lost",
        "owner": "social-designer",
        "required_fix": "Increase score hierarchy and contrast",
        "recheck_scope": ["graphic", "grid preview"],
        "status": "open"
    }]
    errors = validator.validate_review(r)
    assert any("open majors" in e for e in errors)

def test_partial_cannot_publish():
    r = base_review()
    r["review_mode"] = "partial"
    errors = validator.validate_review(r)
    assert any("partial review cannot pass_for_publish" in e for e in errors)

def test_publish_requires_pre_publish_stage():
    r = base_review()
    r["review_stage"] = "post_render"
    errors = validator.validate_review(r)
    assert any("requires review_stage=pre_publish" in e for e in errors)

def test_publish_requires_approval():
    r = base_review()
    r["approval"]["state"] = "required_pending"
    errors = validator.validate_review(r)
    assert any("requires approval" in e for e in errors)

def test_publish_requires_platform_pass():
    r = base_review()
    r["checks"]["platform_preflight"] = "fail"
    errors = validator.validate_review(r)
    assert any("platform_preflight='pass'" in e for e in errors)

def test_major_cannot_be_accepted_non_material():
    r = base_review()
    r["decision"] = "changes_required"
    r["issues"] = [{
        "issue_id": "i1",
        "severity": "major",
        "category": "copy",
        "surface": "caption",
        "evidence": "tone mismatch",
        "problem": "Caption contradicts approved tone",
        "impact": "Brand/editorial drift",
        "owner": "copywriter",
        "required_fix": "Rewrite to approved result tone",
        "recheck_scope": ["caption"],
        "status": "accepted_non_material"
    }]
    errors = validator.validate_review(r)
    assert any("cannot be accepted_non_material" in e for e in errors)

def test_full_review_cannot_have_missing_inputs():
    r = base_review()
    r["decision"] = "changes_required"
    r["scope"]["missing_inputs"] = ["rights metadata"]
    errors = validator.validate_review(r)
    assert any("full review cannot declare missing inputs" in e for e in errors)

def test_duplicate_fact_ids_rejected():
    r = base_review()
    r["decision"] = "changes_required"
    r["source_of_truth"].append(dict(r["source_of_truth"][0]))
    errors = validator.validate_review(r)
    assert any("duplicate fact_id" in e for e in errors)
