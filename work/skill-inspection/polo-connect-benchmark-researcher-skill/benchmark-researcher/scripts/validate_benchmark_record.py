#!/usr/bin/env python3
import json
import sys
from pathlib import Path

ALLOWED_LEVELS = {"E1", "E2", "E3", "E4", "E5"}
ALLOWED_CONFIDENCE = {"high", "medium", "low"}

def validate_record(record):
    errors = []

    for key in ("account", "content", "evidence", "analysis", "transfer", "observed_at"):
        if key not in record:
            errors.append(f"missing required top-level key: {key}")

    evidence = record.get("evidence", {})
    for i, metric in enumerate(evidence.get("metrics", [])):
        level = metric.get("evidence_level")
        if level not in ALLOWED_LEVELS:
            errors.append(f"metric[{i}] invalid evidence_level: {level}")
        if level == "E3" and not metric.get("formula"):
            errors.append(f"metric[{i}] derived metric E3 requires formula")
        if metric.get("name") in {"reach", "impressions", "saves", "shares", "watch_time",
                                  "retention", "completion_rate"}:
            if level not in {"E1", "E2", "E5"}:
                errors.append(
                    f"metric[{i}] hidden/limited metric must be direct/authorized/provider evidence "
                    f"or explicitly unavailable"
                )
        if "source" not in metric:
            errors.append(f"metric[{i}] requires source")

    analysis = record.get("analysis", {})
    if analysis.get("confidence") not in ALLOWED_CONFIDENCE:
        errors.append("analysis.confidence must be high, medium, or low")

    score = analysis.get("utility_score")
    if score is not None and not (0 <= score <= 100):
        errors.append("analysis.utility_score must be 0..100")

    transfer = record.get("transfer", {})
    originality = transfer.get("originality_check", {})
    if originality and originality.get("passes") is False and not originality.get("notes"):
        errors.append("failed originality_check requires notes")

    return errors

def main():
    if len(sys.argv) != 2:
        print("usage: validate_benchmark_record.py <record.json>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    record = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_record(record)

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("OK")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
