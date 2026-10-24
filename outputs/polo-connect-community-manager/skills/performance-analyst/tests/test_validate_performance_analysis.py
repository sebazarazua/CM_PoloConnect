import importlib.util
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "scripts" / "validate_performance_analysis.py"
spec = importlib.util.spec_from_file_location("validator", MODULE_PATH)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

def base_analysis():
    return {
        "analysis_id": "pa_1",
        "scope": {
            "analysis_type": "post",
            "content_ids": ["post_1"],
            "window": "72h",
            "objective": "reach"
        },
        "questions": ["Did this Reel outperform comparable match Reels?"],
        "data_quality": {
            "status": "high",
            "limitations": [],
            "sources": ["Instagram Insights", "Metricool"]
        },
        "metrics": [{
            "metric_id": "m1",
            "name": "organic_reach",
            "value": 18000,
            "source": "Instagram Insights",
            "observed_at": "2026-10-27T20:00:00-03:00",
            "window": "72h",
            "denominator": None,
            "organic_paid_scope": "organic",
            "definition_version": "2026-10",
            "availability_status": "available"
        }],
        "baselines": [{
            "baseline_id": "b1",
            "description": "Comparable match Reels, 72h organic reach",
            "sample_size": 12,
            "comparison_quality": "high",
            "median_values": {"organic_reach": 10000},
            "exclusions": ["boosted posts", "finals"]
        }],
        "results": [{
            "statement": "Organic reach was 1.8x the comparable median.",
            "evidence_ids": ["m1", "b1"],
            "effect": "1.8x"
        }],
        "diagnoses": [{
            "hypothesis": "Peak-action opening may have contributed.",
            "confidence": "medium",
            "confounders": ["player popularity"],
            "evidence_ids": ["m1", "b1"],
            "causal_claim": False
        }],
        "learnings": [{
            "learning_id": "l1",
            "statement": "Peak-action-first is worth testing again for decisive match Reels.",
            "maturity": "internal_observation",
            "confidence": "medium",
            "scope": "decisive match Reels",
            "sample_size": 1,
            "next_test": "Replicate on 3 comparable match moments."
        }],
        "actions": [{
            "action": "test_again",
            "reason": "Positive result but causal evidence is incomplete.",
            "owner": "reel-planner"
        }],
        "handoffs": [{
            "target_skill": "reel-planner",
            "finding": "Peak-action-first showed a positive relative signal.",
            "confidence": "medium",
            "scope": "decisive match Reels",
            "do_not_generalize": "Do not apply to all Reel types.",
            "next_validation": "Replicate across comparable match moments."
        }],
        "observed_at": "2026-10-27T20:05:00-03:00"
    }

def test_valid_analysis():
    assert validator.validate_analysis(base_analysis()) == []

def test_available_metric_requires_value():
    r = base_analysis()
    r["metrics"][0]["value"] = None
    errors = validator.validate_analysis(r)
    assert any("available metric requires value" in e for e in errors)

def test_result_cannot_reference_unknown_evidence():
    r = base_analysis()
    r["results"][0]["evidence_ids"] = ["missing"]
    errors = validator.validate_analysis(r)
    assert any("unknown evidence IDs" in e for e in errors)

def test_high_confidence_causal_requires_high_data_quality():
    r = base_analysis()
    r["data_quality"]["status"] = "medium"
    r["diagnoses"][0]["causal_claim"] = True
    r["diagnoses"][0]["confidence"] = "high"
    r["diagnoses"][0]["confounders"] = []
    errors = validator.validate_analysis(r)
    assert any("requires high data quality" in e for e in errors)

def test_high_confidence_causal_rejects_confounders():
    r = base_analysis()
    r["diagnoses"][0]["causal_claim"] = True
    r["diagnoses"][0]["confidence"] = "high"
    r["diagnoses"][0]["confounders"] = ["final match"]
    errors = validator.validate_analysis(r)
    assert any("unresolved confounders" in e for e in errors)

def test_validated_learning_requires_repeated_evidence():
    r = base_analysis()
    r["learnings"][0]["maturity"] = "validated_internal_pattern"
    r["learnings"][0]["sample_size"] = 1
    errors = validator.validate_analysis(r)
    assert any("requires repeated evidence" in e for e in errors)

def test_insufficient_data_cannot_retire_strategy():
    r = base_analysis()
    r["data_quality"]["status"] = "insufficient"
    r["actions"] = [{
        "action": "retire",
        "reason": "Weak result",
        "owner": "editorial-strategist"
    }]
    errors = validator.validate_analysis(r)
    assert any("unsupported with insufficient data" in e for e in errors)

def test_definition_change_requires_documentation():
    r = base_analysis()
    r["metrics"][0]["availability_status"] = "definition_changed"
    r["data_quality"]["limitations"] = []
    errors = validator.validate_analysis(r)
    assert any("definition changed" in e for e in errors)

def test_definition_change_documented_is_valid():
    r = base_analysis()
    r["metrics"][0]["availability_status"] = "definition_changed"
    r["data_quality"]["limitations"] = ["Metric definition changed in October 2026."]
    r["results"] = []
    r["diagnoses"] = []
    assert validator.validate_analysis(r) == []

def test_duplicate_metric_id_rejected():
    r = base_analysis()
    r["metrics"].append(dict(r["metrics"][0]))
    errors = validator.validate_analysis(r)
    assert any("duplicate metric_id" in e for e in errors)

def test_low_quality_cannot_validate_pattern():
    r = base_analysis()
    r["data_quality"]["status"] = "low"
    r["learnings"][0]["maturity"] = "validated_internal_pattern"
    r["learnings"][0]["sample_size"] = 5
    errors = validator.validate_analysis(r)
    assert any("maturity too strong" in e for e in errors)
