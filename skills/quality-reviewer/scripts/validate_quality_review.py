#!/usr/bin/env python3
import json
import sys
from pathlib import Path

DECISIONS = {
    "pass_for_human_approval", "pass_for_publish", "changes_required",
    "blocked_verification", "blocked_rights", "blocked_compliance",
    "blocked_technical", "replan_required", "reject"
}
STAGES = {"pre_render", "post_render", "pre_publish"}
MODES = {"full", "partial", "delta"}
SEVERITIES = {"blocker", "major", "minor", "note"}
ISSUE_STATUSES = {"open", "fixed_pending_recheck", "closed", "accepted_non_material"}
APPROVAL_STATES = {"not_required", "required_pending", "approved", "reapproval_required"}

def validate_review(record):
    errors = []

    required = [
        "review_id", "content_id", "review_stage", "review_mode", "decision",
        "scope", "versions", "source_of_truth", "issues", "checks",
        "approval", "observed_at"
    ]
    for key in required:
        if key not in record:
            errors.append(f"missing required top-level key: {key}")

    stage = record.get("review_stage")
    mode = record.get("review_mode")
    decision = record.get("decision")

    if stage not in STAGES:
        errors.append(f"invalid review_stage: {stage}")
    if mode not in MODES:
        errors.append(f"invalid review_mode: {mode}")
    if decision not in DECISIONS:
        errors.append(f"invalid decision: {decision}")

    issues = record.get("issues", [])
    open_blockers = []
    open_majors = []

    seen_ids = set()
    for i, issue in enumerate(issues):
        iid = issue.get("issue_id")
        if not iid:
            errors.append(f"issues[{i}] missing issue_id")
        elif iid in seen_ids:
            errors.append(f"duplicate issue_id: {iid}")
        else:
            seen_ids.add(iid)

        sev = issue.get("severity")
        if sev not in SEVERITIES:
            errors.append(f"issues[{i}] invalid severity")
        status = issue.get("status")
        if status not in ISSUE_STATUSES:
            errors.append(f"issues[{i}] invalid status")

        for key in ("category", "surface", "problem", "impact", "owner", "required_fix"):
            if not issue.get(key):
                errors.append(f"issues[{i}].{key} required")

        if not issue.get("recheck_scope"):
            errors.append(f"issues[{i}].recheck_scope required")

        if status in {"open", "fixed_pending_recheck"}:
            if sev == "blocker":
                open_blockers.append(iid)
            elif sev == "major":
                open_majors.append(iid)

        if status == "accepted_non_material" and sev in {"blocker", "major"}:
            errors.append(f"issues[{i}] blocker/major cannot be accepted_non_material")

    passing = {"pass_for_human_approval", "pass_for_publish"}
    if decision in passing and open_blockers:
        errors.append(f"{decision} incompatible with open blockers: {open_blockers}")
    if decision in passing and open_majors:
        errors.append(f"{decision} incompatible with open majors: {open_majors}")

    scope = record.get("scope", {})
    missing = scope.get("missing_inputs", [])
    if mode == "full" and missing:
        errors.append("full review cannot declare missing inputs")
    if decision == "pass_for_publish" and mode == "partial":
        errors.append("partial review cannot pass_for_publish")
    if decision == "pass_for_publish" and stage != "pre_publish":
        errors.append("pass_for_publish requires review_stage=pre_publish")

    approval = record.get("approval", {})
    approval_state = approval.get("state")
    if approval_state not in APPROVAL_STATES:
        errors.append("invalid approval.state")
    if decision == "pass_for_publish" and approval_state not in {"approved", "not_required"}:
        errors.append("pass_for_publish requires approval approved or not_required")

    checks = record.get("checks", {})
    required_checks = [
        "facts", "editorial_alignment", "copy", "visual_or_video",
        "authenticity", "originality", "rights", "sponsor_compliance",
        "accessibility", "platform_preflight", "timing", "brand_integrity"
    ]
    for key in required_checks:
        if not checks.get(key):
            errors.append(f"checks.{key} required")

    if decision == "pass_for_publish":
        if not scope.get("publishing_route"):
            errors.append("pass_for_publish requires explicit publishing_route")
        if checks.get("platform_preflight") != "pass":
            errors.append("pass_for_publish requires checks.platform_preflight='pass'")
        if checks.get("rights") != "pass":
            errors.append("pass_for_publish requires checks.rights='pass'")
        if checks.get("facts") != "pass":
            errors.append("pass_for_publish requires checks.facts='pass'")

    # Source-of-truth IDs should be unique.
    fact_ids = []
    for i, fact in enumerate(record.get("source_of_truth", [])):
        fid = fact.get("fact_id")
        if not fid:
            errors.append(f"source_of_truth[{i}] missing fact_id")
        else:
            fact_ids.append(fid)
        if not fact.get("fact"):
            errors.append(f"source_of_truth[{i}] missing fact")
        if not fact.get("status"):
            errors.append(f"source_of_truth[{i}] missing status")
    if len(fact_ids) != len(set(fact_ids)):
        errors.append("duplicate fact_id in source_of_truth")

    return errors

def main():
    if len(sys.argv) != 2:
        print("usage: validate_quality_review.py <review.json>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    record = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_review(record)

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("OK")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
