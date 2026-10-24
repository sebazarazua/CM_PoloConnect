import importlib.util
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "validate_news_event.py"
spec = importlib.util.spec_from_file_location("validator", MODULE_PATH)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

def base_event():
    return {
        "event_id": "evt_1",
        "event_type": "match_result",
        "headline_working": "Example result",
        "entities": [],
        "time": {},
        "claims": [{
            "claim": "Team A beat Team B 10-9",
            "status": "confirmed_primary",
            "confidence": "high",
            "source_ids": ["s1"]
        }],
        "sources": [{
            "source_id": "s1",
            "url": "https://example.com",
            "role": "primary_official",
            "observed_at": "2026-10-24T20:00:00-03:00"
        }],
        "editorial": {
            "action_state": "publish_now",
            "urgency": "same_day",
            "editorial_score": 80,
            "why_it_matters": "Relevant result"
        },
        "rights": {"media_status": "owned"},
        "observed_at": "2026-10-24T20:00:00-03:00"
    }

def test_valid_event():
    assert validator.validate_event(base_event()) == []

def test_multisource_requires_two_sources():
    event = base_event()
    event["claims"][0]["status"] = "confirmed_multi_source"
    errors = validator.validate_event(event)
    assert any("requires >=2 sources" in e for e in errors)

def test_publish_now_rejects_rumor():
    event = base_event()
    event["claims"][0]["status"] = "rumor"
    event["claims"][0]["confidence"] = "low"
    errors = validator.validate_event(event)
    assert any("publish_now cannot" in e for e in errors)

def test_unknown_source_reference():
    event = base_event()
    event["claims"][0]["source_ids"] = ["missing"]
    errors = validator.validate_event(event)
    assert any("unknown source_ids" in e for e in errors)
