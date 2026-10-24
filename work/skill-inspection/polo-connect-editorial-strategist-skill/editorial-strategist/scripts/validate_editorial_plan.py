#!/usr/bin/env python3
import json
import sys
from pathlib import Path
from datetime import datetime

HORIZONS = {"seasonal", "tournament", "monthly", "weekly"}
EMPHASIS = {"core", "supporting", "opportunistic", "reduced"}
CONFIDENCE = {"high_confidence", "medium_confidence", "experimental"}

def validate_plan(record):
    errors = []

    required = [
        "plan_id", "planning_window", "audiences", "objectives", "pillars",
        "series", "calendar_policy", "capacity", "experiments",
        "opportunity_detector_brief", "review", "observed_at"
    ]
    for key in required:
        if key not in record:
            errors.append(f"missing required top-level key: {key}")

    window = record.get("planning_window", {})
    if window.get("horizon") not in HORIZONS:
        errors.append("invalid planning_window.horizon")
    if not window.get("starts_at") or not window.get("ends_at"):
        errors.append("planning_window requires starts_at and ends_at")

    objectives = record.get("objectives", [])
    if len(objectives) == 0:
        errors.append("at least one strategic objective is required")
    if len(objectives) > 4:
        errors.append("too many primary objectives; keep strategic focus")
    for i, obj in enumerate(objectives):
        if not obj.get("objective"):
            errors.append(f"objectives[{i}].objective required")
        if not obj.get("primary_kpi"):
            errors.append(f"objectives[{i}].primary_kpi required")
        conf = obj.get("confidence")
        if conf is not None and conf not in CONFIDENCE:
            errors.append(f"objectives[{i}] invalid confidence")

    for i, pillar in enumerate(record.get("pillars", [])):
        if pillar.get("current_emphasis") not in EMPHASIS:
            errors.append(f"pillars[{i}] invalid current_emphasis")
        if not pillar.get("audience_need"):
            errors.append(f"pillars[{i}] requires audience_need")

    policy = record.get("calendar_policy", {})
    if policy.get("empty_days_allowed") is not True:
        errors.append("calendar_policy.empty_days_allowed must be true; strategy must not force filler content")

    capacity = record.get("capacity", {})
    total = capacity.get("total_units")
    planned = capacity.get("planned_units")
    reactive = capacity.get("reactive_reserved_units")
    if all(isinstance(x, (int, float)) for x in [total, planned, reactive]):
        if planned + reactive > total:
            errors.append("planned_units + reactive_reserved_units cannot exceed total_units")
        if total > 0 and reactive == 0:
            errors.append("sports editorial planning should reserve reactive capacity unless explicitly modeled elsewhere")

    brief = record.get("opportunity_detector_brief", {})
    for key in ("current_objectives", "priority_audiences", "active_narratives"):
        if key not in brief:
            errors.append(f"opportunity_detector_brief.{key} required")

    # Do not allow a fake rigid quota field at top level.
    forbidden = {"reels_percentage", "carousel_percentage", "stories_percentage", "posts_per_day_required"}
    for key in forbidden:
        if key in record:
            errors.append(f"forbidden rigid strategy field: {key}")

    return errors

def main():
    if len(sys.argv) != 2:
        print("usage: validate_editorial_plan.py <plan.json>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    record = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_plan(record)

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("OK")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
