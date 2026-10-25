#!/usr/bin/env python3
import json
import sys
from pathlib import Path

CLAIM_STATUSES = {
    "confirmed_primary", "confirmed_multi_source", "reported_single_source",
    "participant_claim", "rumor", "disputed", "false_or_corrected", "unknown"
}
CONFIDENCE = {"high", "medium", "low"}
ACTIONS = {"publish_now", "prepare", "monitor", "background_only", "reject"}
RIGHTS = {
    "owned", "licensed", "permission_confirmed", "platform_embed_only",
    "editorial_reference_only", "rights_unknown", "restricted"
}
HIGH_RISK_HINTS = {"injury", "hospital", "death", "died", "sanction", "suspended",
                   "lawsuit", "arrest", "abuse", "fraud", "contract"}

def validate_event(record):
    errors = []
    required = ["event_id", "event_type", "headline_working", "entities", "time",
                "claims", "sources", "editorial", "rights", "observed_at"]
    for key in required:
        if key not in record:
            errors.append(f"missing required top-level key: {key}")

    source_ids = {s.get("source_id") for s in record.get("sources", []) if s.get("source_id")}
    for i, claim in enumerate(record.get("claims", [])):
        status = claim.get("status")
        conf = claim.get("confidence")
        if status not in CLAIM_STATUSES:
            errors.append(f"claim[{i}] invalid status: {status}")
        if conf not in CONFIDENCE:
            errors.append(f"claim[{i}] invalid confidence: {conf}")
        refs = claim.get("source_ids", [])
        missing = [x for x in refs if x not in source_ids]
        if missing:
            errors.append(f"claim[{i}] references unknown source_ids: {missing}")
        if status == "confirmed_multi_source" and len(set(refs)) < 2:
            errors.append(f"claim[{i}] confirmed_multi_source requires >=2 sources")
        if status in {"rumor", "unknown", "disputed"} and conf == "high":
            errors.append(f"claim[{i}] {status} should not have high confidence")

    editorial = record.get("editorial", {})
    action = editorial.get("action_state")
    if action not in ACTIONS:
        errors.append(f"invalid editorial.action_state: {action}")
    score = editorial.get("editorial_score")
    if score is not None and not (0 <= score <= 100):
        errors.append("editorial.editorial_score must be 0..100")

    # Central unresolved claims are incompatible with publish_now.
    unresolved = [c for c in record.get("claims", [])
                  if c.get("status") in {"rumor", "disputed", "unknown"}]
    if action == "publish_now" and unresolved:
        errors.append("publish_now cannot contain unresolved rumor/disputed/unknown claims without explicit separation")

    rights = record.get("rights", {})
    if rights.get("media_status") not in RIGHTS:
        errors.append("invalid rights.media_status")

    return errors

def main():
    if len(sys.argv) != 2:
        print("usage: validate_news_event.py <event.json>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    record = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_event(record)
    if errors:
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        return 1
    print("OK")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
