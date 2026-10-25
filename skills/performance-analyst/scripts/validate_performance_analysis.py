#!/usr/bin/env python3
import json
import sys
from pathlib import Path

DATA_QUALITY = {"high", "medium", "low", "insufficient"}
AVAILABILITY = {
    "available", "not_available", "not_authorized",
    "not_applicable", "not_captured", "definition_changed"
}
CONFIDENCE = {"high", "medium", "low"}
MATURITY = {
    "external_hypothesis", "internal_observation", "repeated_internal_signal",
    "validated_internal_pattern", "strategic_rule_candidate"
}
ACTIONS = {
    "continue", "increase", "decrease", "iterate",
    "pause", "retire", "test_again", "needs_more_data"
}

def validate_analysis(record):
    errors = []

    required = [
        "analysis_id", "scope", "questions", "data_quality", "metrics",
        "baselines", "results", "diagnoses", "learnings", "actions",
        "handoffs", "observed_at"
    ]
    for key in required:
        if key not in record:
            errors.append(f"missing required top-level key: {key}")

    dq = record.get("data_quality", {})
    dq_status = dq.get("status")
    if dq_status not in DATA_QUALITY:
        errors.append("invalid data_quality.status")

    metric_ids = set()
    metric_by_id = {}
    for i, metric in enumerate(record.get("metrics", [])):
        mid = metric.get("metric_id")
        if not mid:
            errors.append(f"metrics[{i}] missing metric_id")
        elif mid in metric_ids:
            errors.append(f"duplicate metric_id: {mid}")
        else:
            metric_ids.add(mid)
            metric_by_id[mid] = metric

        if metric.get("availability_status") not in AVAILABILITY:
            errors.append(f"metrics[{i}] invalid availability_status")

        if metric.get("availability_status") == "available":
            if metric.get("value") is None:
                errors.append(f"metrics[{i}] available metric requires value")
            if not metric.get("source"):
                errors.append(f"metrics[{i}] available metric requires source")
            if not metric.get("observed_at"):
                errors.append(f"metrics[{i}] available metric requires observed_at")

    baseline_ids = set()
    for i, baseline in enumerate(record.get("baselines", [])):
        bid = baseline.get("baseline_id")
        if not bid:
            errors.append(f"baselines[{i}] missing baseline_id")
        elif bid in baseline_ids:
            errors.append(f"duplicate baseline_id: {bid}")
        baseline_ids.add(bid)
        if baseline.get("comparison_quality") not in {"high", "medium", "low"}:
            errors.append(f"baselines[{i}] invalid comparison_quality")

    # Results may only cite existing metric/baseline IDs.
    allowed_evidence = metric_ids | baseline_ids
    for i, result in enumerate(record.get("results", [])):
        refs = result.get("evidence_ids", [])
        missing = [r for r in refs if r not in allowed_evidence]
        if missing:
            errors.append(f"results[{i}] references unknown evidence IDs: {missing}")

    for i, diag in enumerate(record.get("diagnoses", [])):
        conf = diag.get("confidence")
        if conf not in CONFIDENCE:
            errors.append(f"diagnoses[{i}] invalid confidence")
        refs = diag.get("evidence_ids", [])
        missing = [r for r in refs if r not in allowed_evidence]
        if missing:
            errors.append(f"diagnoses[{i}] references unknown evidence IDs: {missing}")

        # High-confidence causal claims require good data quality.
        if diag.get("causal_claim") is True and conf == "high" and dq_status not in {"high"}:
            errors.append(
                f"diagnoses[{i}] high-confidence causal claim requires high data quality"
            )

        # Low sample / confounded causal claims should not be high confidence.
        if diag.get("causal_claim") is True and conf == "high" and diag.get("confounders"):
            errors.append(
                f"diagnoses[{i}] high-confidence causal claim incompatible with unresolved confounders"
            )

    for i, learning in enumerate(record.get("learnings", [])):
        maturity = learning.get("maturity")
        conf = learning.get("confidence")
        if maturity not in MATURITY:
            errors.append(f"learnings[{i}] invalid maturity")
        if conf not in CONFIDENCE:
            errors.append(f"learnings[{i}] invalid confidence")

        sample = learning.get("sample_size")
        if maturity in {"validated_internal_pattern", "strategic_rule_candidate"}:
            if dq_status in {"low", "insufficient"}:
                errors.append(
                    f"learnings[{i}] maturity too strong for data quality={dq_status}"
                )
            if sample is not None and sample < 2:
                errors.append(
                    f"learnings[{i}] validated maturity requires repeated evidence"
                )

    for i, action in enumerate(record.get("actions", [])):
        if action.get("action") not in ACTIONS:
            errors.append(f"actions[{i}] invalid action")
        if not action.get("reason"):
            errors.append(f"actions[{i}] reason required")
        if not action.get("owner"):
            errors.append(f"actions[{i}] owner required")

    # Insufficient data should not support strong irreversible actions.
    if dq_status == "insufficient":
        forbidden = {"increase", "decrease", "pause", "retire"}
        for i, action in enumerate(record.get("actions", [])):
            if action.get("action") in forbidden:
                errors.append(
                    f"actions[{i}] {action.get('action')} unsupported with insufficient data"
                )

    # Warn structurally if a metric definition changed but is treated as a normal comparable.
    changed_metrics = [
        m.get("metric_id")
        for m in record.get("metrics", [])
        if m.get("availability_status") == "definition_changed"
    ]
    if changed_metrics:
        # Require at least one limitation acknowledging definition change.
        limitations_text = " ".join(dq.get("limitations", [])).lower()
        if "definition" not in limitations_text and "defin" not in limitations_text:
            errors.append(
                "metric definition changed but data_quality.limitations does not document it"
            )

    return errors

def main():
    if len(sys.argv) != 2:
        print("usage: validate_performance_analysis.py <analysis.json>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    record = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_analysis(record)

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("OK")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
