#!/usr/bin/env python3
import json
import sys
from pathlib import Path

DECISIONS = {
    "produce_now", "produce_scheduled", "merge", "story_only", "monitor",
    "hold", "blocked_verification", "blocked_assets", "reject"
}
PRIORITIES = {"P0", "P1", "P2", "P3", "P4"}
READINESS = {
    "ready", "ready_with_light_work", "capture_required", "data_required",
    "permission_required", "missing_critical_asset"
}
TIMING = {"live", "reactive", "same_day", "scheduled", "evergreen", "seasonal"}

def validate_opportunity(record):
    errors = []
    required = [
        "opportunity_id", "source_candidates", "eligibility", "strategy",
        "timing", "format", "assets", "decision", "handoff", "observed_at"
    ]
    for key in required:
        if key not in record:
            errors.append(f"missing required top-level key: {key}")

    eligibility = record.get("eligibility", {})
    eligible = eligibility.get("eligible")
    blockers = eligibility.get("blockers", [])

    decision = record.get("decision", {})
    state = decision.get("state")
    if state not in DECISIONS:
        errors.append(f"invalid decision.state: {state}")
    if decision.get("priority") not in PRIORITIES:
        errors.append("invalid decision.priority")
    score = decision.get("opportunity_score")
    if score is not None and not (0 <= score <= 100):
        errors.append("decision.opportunity_score must be 0..100")

    timing = record.get("timing", {})
    if timing.get("timing_class") not in TIMING:
        errors.append("invalid timing.timing_class")

    assets = record.get("assets", {})
    readiness = assets.get("readiness")
    if readiness not in READINESS:
        errors.append("invalid assets.readiness")

    approved_states = {"produce_now", "produce_scheduled", "story_only"}
    if state in approved_states and eligible is False:
        errors.append(f"{state} requires eligibility.eligible=true")
    if state in approved_states and blockers:
        errors.append(f"{state} cannot retain hard blockers")
    if state == "produce_now" and readiness in {"permission_required", "missing_critical_asset"}:
        errors.append("produce_now incompatible with unresolved critical asset/permission state")
    if state == "blocked_verification" and eligible is True:
        errors.append("blocked_verification should not be marked eligible")
    if state == "blocked_assets" and readiness not in {
        "capture_required", "data_required", "permission_required", "missing_critical_asset"
    }:
        errors.append("blocked_assets requires an unresolved asset readiness state")
    if state == "merge" and not decision.get("merge_with"):
        errors.append("merge requires decision.merge_with")

    strategy = record.get("strategy", {})
    for key in ("primary_objective", "audience_job", "editorial_angle", "why_now", "why_polo_connect"):
        if not strategy.get(key):
            errors.append(f"strategy.{key} is required and cannot be empty")

    handoff = record.get("handoff", {})
    if state in approved_states and not handoff.get("downstream_skill"):
        errors.append(f"{state} requires handoff.downstream_skill")
    if state in approved_states and not handoff.get("success_signal"):
        errors.append(f"{state} requires handoff.success_signal")

    return errors

def main():
    if len(sys.argv) != 2:
        print("usage: validate_content_opportunity.py <record.json>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    record = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_opportunity(record)

    if errors:
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        return 1

    print("OK")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
