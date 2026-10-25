import importlib.util
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "validate_social_copy.py"
spec = importlib.util.spec_from_file_location("validator", MODULE_PATH)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

def base_copy():
    return {
        "copy_id": "copy_1",
        "opportunity_id": "opp_1",
        "state": "ready_for_approval",
        "language": "es-AR",
        "tone_mode": "result",
        "copy_job": "Add consequence and next-match context to the result graphic.",
        "source_facts": [{
            "fact_id": "f1",
            "fact": "La Natividad won 14-12.",
            "verification_status": "confirmed_primary",
            "source_id": "evt_1"
        }],
        "outputs": {
            "caption": "La Natividad cerró la final 14-12 y se quedó con el título.",
            "headline": "LA NATIVIDAD, CAMPEÓN",
            "subheadline": None,
            "overlays": ["FINAL 14-12"],
            "slide_copy": [],
            "story_frames": [],
            "cta": None,
            "hashtags": ["#Polo"],
            "mentions": [],
            "alt_text_draft": None
        },
        "qa": {
            "facts_checked": True,
            "anti_ai_checked": True,
            "originality_checked": True,
            "tone_checked": True,
            "asset_consistency_checked": True,
            "notes": None
        },
        "observed_at": "2026-10-24T22:00:00-03:00"
    }

def test_valid_copy():
    assert validator.validate_copy(base_copy()) == []

def test_ready_requires_all_qa():
    r = base_copy()
    r["qa"]["anti_ai_checked"] = False
    errors = validator.validate_copy(r)
    assert any("anti_ai_checked" in e for e in errors)

def test_placeholder_rejected():
    r = base_copy()
    r["outputs"]["caption"] = "Ganó {{TEAM}} por 14-12."
    errors = validator.validate_copy(r)
    assert any("placeholder" in e for e in errors)

def test_generic_ai_pattern_requires_justification():
    r = base_copy()
    r["outputs"]["caption"] = "No es solo un partido, es una historia."
    errors = validator.validate_copy(r)
    assert any("generic/AI-pattern" in e for e in errors)

def test_generic_pattern_can_be_explicitly_justified():
    r = base_copy()
    r["outputs"]["caption"] = "No es solo un partido, es una historia."
    r["qa"]["notes"] = "Intentional wording required by approved campaign."
    assert validator.validate_copy(r) == []

def test_duplicate_hashtag_rejected():
    r = base_copy()
    r["outputs"]["hashtags"] = ["#Polo", "#polo"]
    errors = validator.validate_copy(r)
    assert any("duplicate hashtags" in e for e in errors)

def test_invalid_mention_rejected():
    r = base_copy()
    r["outputs"]["mentions"] = ["La Natividad"]
    errors = validator.validate_copy(r)
    assert any("invalid handle" in e for e in errors)

def test_ready_requires_output():
    r = base_copy()
    r["outputs"]["caption"] = None
    r["outputs"]["headline"] = None
    r["outputs"]["overlays"] = []
    r["outputs"]["slide_copy"] = []
    r["outputs"]["story_frames"] = []
    errors = validator.validate_copy(r)
    assert any("publishable output" in e for e in errors)
