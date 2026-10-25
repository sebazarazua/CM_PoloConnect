#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

STATES = {
    "ready_for_approval", "ready_for_publish", "blocked_verification",
    "blocked_required_input", "replan_required"
}

GENERIC_PATTERNS = [
    r"\bno es solo\b",
    r"\bmás que (un|una)\b",
    r"\bno vas a (poder )?creer\b",
    r"\besper[aá] hasta el final\b",
    r"\buna experiencia [uú]nica\b",
    r"\buna jornada inolvidable\b",
    r"\bla pasi[oó]n se hizo presente\b",
]

PLACEHOLDER_PATTERNS = [
    r"\bTBD\b",
    r"\bTODO\b",
    r"\[INSERT",
    r"\[AGREGAR",
    r"\{\{.+?\}\}",
]

def _all_text(record):
    outputs = record.get("outputs", {})
    chunks = []
    for key in ("caption", "headline", "subheadline", "cta", "alt_text_draft"):
        value = outputs.get(key)
        if isinstance(value, str):
            chunks.append(value)
    chunks.extend(outputs.get("overlays", []) or [])
    chunks.extend(outputs.get("hashtags", []) or [])
    for item in outputs.get("slide_copy", []) or []:
        chunks.extend(item.get("text", []) or [])
    for item in outputs.get("story_frames", []) or []:
        chunks.extend(item.get("text", []) or [])
        if item.get("interaction_prompt"):
            chunks.append(item["interaction_prompt"])
    return "\n".join(chunks)

def validate_copy(record):
    errors = []

    required = [
        "copy_id", "opportunity_id", "state", "language", "tone_mode",
        "copy_job", "source_facts", "outputs", "qa", "observed_at"
    ]
    for key in required:
        if key not in record:
            errors.append(f"missing required top-level key: {key}")

    state = record.get("state")
    if state not in STATES:
        errors.append(f"invalid state: {state}")

    if not record.get("language"):
        errors.append("language required")
    if not record.get("tone_mode"):
        errors.append("tone_mode required")
    if not record.get("copy_job"):
        errors.append("copy_job required")

    facts = record.get("source_facts", [])
    fact_ids = set()
    for i, fact in enumerate(facts):
        fid = fact.get("fact_id")
        if not fid:
            errors.append(f"source_facts[{i}] missing fact_id")
        else:
            if fid in fact_ids:
                errors.append(f"duplicate fact_id: {fid}")
            fact_ids.add(fid)
        if not fact.get("fact"):
            errors.append(f"source_facts[{i}] missing fact")
        if not fact.get("verification_status"):
            errors.append(f"source_facts[{i}] missing verification_status")

    qa = record.get("qa", {})
    if state in {"ready_for_approval", "ready_for_publish"}:
        for field in (
            "facts_checked", "anti_ai_checked", "originality_checked",
            "tone_checked", "asset_consistency_checked"
        ):
            if qa.get(field) is not True:
                errors.append(f"{state} requires qa.{field}=true")

    text = _all_text(record)

    if state in {"ready_for_approval", "ready_for_publish"}:
        for pattern in PLACEHOLDER_PATTERNS:
            if re.search(pattern, text, flags=re.I):
                errors.append("ready copy contains unresolved placeholder")
                break

    # Anti-AI patterns are not universally forbidden, but if present in ready copy,
    # require an explicit QA note explaining why they are intentional.
    found_generic = [
        p for p in GENERIC_PATTERNS if re.search(p, text, flags=re.I)
    ]
    if state in {"ready_for_approval", "ready_for_publish"} and found_generic:
        note = (qa.get("notes") or "").lower()
        if "intentional" not in note and "justified" not in note:
            errors.append("ready copy contains generic/AI-pattern language without explicit justification")

    # Hashtags should be well-formed and deduplicated.
    hashtags = record.get("outputs", {}).get("hashtags", []) or []
    normalized = []
    for i, tag in enumerate(hashtags):
        if not isinstance(tag, str) or not tag.startswith("#") or len(tag) < 2:
            errors.append(f"hashtags[{i}] invalid")
        normalized.append(tag.lower() if isinstance(tag, str) else str(tag))
    if len(normalized) != len(set(normalized)):
        errors.append("duplicate hashtags")

    # Mentions must be explicit handles, never inferred names.
    mentions = record.get("outputs", {}).get("mentions", []) or []
    for i, mention in enumerate(mentions):
        if not isinstance(mention, str) or not mention.startswith("@") or len(mention) < 2:
            errors.append(f"mentions[{i}] invalid handle")

    # Ready copy must contain at least one meaningful output.
    outputs = record.get("outputs", {})
    meaningful = [
        outputs.get("caption"),
        outputs.get("headline"),
        outputs.get("overlays"),
        outputs.get("slide_copy"),
        outputs.get("story_frames")
    ]
    if state in {"ready_for_approval", "ready_for_publish"} and not any(meaningful):
        errors.append("ready copy requires at least one publishable output")

    return errors

def main():
    if len(sys.argv) != 2:
        print("usage: validate_social_copy.py <copy.json>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    record = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_copy(record)

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("OK")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
