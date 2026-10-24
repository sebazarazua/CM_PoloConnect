import importlib.util
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "validate_benchmark_record.py"
spec = importlib.util.spec_from_file_location("validator", MODULE_PATH)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

def base_record():
    return {
        "account": {},
        "content": {},
        "evidence": {"metrics": []},
        "analysis": {"confidence": "medium", "utility_score": 75},
        "transfer": {"originality_check": {"passes": True, "notes": "original"}},
        "observed_at": "2026-10-24T19:00:00-03:00",
    }

def test_valid_record():
    assert validator.validate_record(base_record()) == []

def test_derived_metric_requires_formula():
    record = base_record()
    record["evidence"]["metrics"] = [{
        "name": "comments_per_1000_followers",
        "value": 2.4,
        "evidence_level": "E3",
        "source": "calculated",
        "formula": None
    }]
    errors = validator.validate_record(record)
    assert any("requires formula" in e for e in errors)

def test_hidden_metric_cannot_be_unsupported_inference():
    record = base_record()
    record["evidence"]["metrics"] = [{
        "name": "reach",
        "value": 100000,
        "evidence_level": "E4",
        "source": "inference"
    }]
    errors = validator.validate_record(record)
    assert any("hidden/limited metric" in e for e in errors)
