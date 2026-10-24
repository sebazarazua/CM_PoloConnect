#!/usr/bin/env python3
import json
import sys
from pathlib import Path

STATES = {
    "ready_for_edit", "ready_with_capture_request", "blocked_assets",
    "blocked_verification", "blocked_rights", "replan_required"
}
SELECTIONS = {"must_use", "strong_option", "context_only", "optional", "avoid"}
AUDIO_MODES = {
    "natural_sound_led", "commentary_led", "music_led", "voiceover_led", "hybrid"
}

def validate_reel_plan(record):
    errors = []

    required = [
        "reel_id", "opportunity_id", "state", "strategy", "rights",
        "footage", "hook", "narrative", "text", "audio", "cover",
        "handoff", "observed_at"
    ]
    for key in required:
        if key not in record:
            errors.append(f"missing required top-level key: {key}")

    state = record.get("state")
    if state not in STATES:
        errors.append(f"invalid state: {state}")

    strategy = record.get("strategy", {})
    for key in ("reel_job", "primary_objective", "audience_job", "success_signal"):
        if not strategy.get(key):
            errors.append(f"strategy.{key} required")

    dur = strategy.get("target_duration_seconds")
    if dur:
        mn, mx = dur.get("min"), dur.get("max")
        if not isinstance(mn, (int, float)) or not isinstance(mx, (int, float)):
            errors.append("target_duration_seconds min/max must be numeric")
        elif mn <= 0 or mx < mn:
            errors.append("invalid target_duration_seconds range")

    footage = record.get("footage", [])
    must_use_count = 0
    source_ids = set()
    for i, clip in enumerate(footage):
        sid = clip.get("source_id")
        if not sid:
            errors.append(f"footage[{i}] missing source_id")
        else:
            source_ids.add(sid)
        sel = clip.get("selection_status")
        if sel not in SELECTIONS:
            errors.append(f"footage[{i}] invalid selection_status")
        if sel == "must_use":
            must_use_count += 1
        if not clip.get("rights_status"):
            errors.append(f"footage[{i}] missing rights_status")

    if state == "ready_for_edit" and must_use_count == 0:
        errors.append("ready_for_edit requires at least one must_use clip")

    rights = record.get("rights", {})
    if state == "ready_for_edit":
        for field in ("video_status", "audio_status"):
            status = rights.get(field)
            if status in {None, "", "rights_unknown", "restricted"}:
                errors.append(f"ready_for_edit incompatible with {field}={status}")

    hook = record.get("hook", {})
    if not hook.get("type") or not hook.get("description"):
        errors.append("hook type and description required")
    hook_sid = hook.get("source_id")
    if hook_sid and hook_sid not in source_ids:
        errors.append("hook.source_id must reference an existing footage source_id")

    narrative = record.get("narrative", {})
    beats = narrative.get("beats", [])
    if state == "ready_for_edit" and not beats:
        errors.append("ready_for_edit requires narrative beats")
    previous_start = -1
    for i, beat in enumerate(beats):
        s, e = beat.get("start_s"), beat.get("end_s")
        if not isinstance(s, (int, float)) or not isinstance(e, (int, float)):
            errors.append(f"beat[{i}] start_s/end_s must be numeric")
            continue
        if e <= s:
            errors.append(f"beat[{i}] end_s must be greater than start_s")
        if s < previous_start:
            errors.append("narrative beats must be ordered by start_s")
        previous_start = s
        sid = beat.get("source_id")
        if sid and sid not in source_ids:
            errors.append(f"beat[{i}] source_id not found in footage")

    audio = record.get("audio", {})
    if audio.get("mode") not in AUDIO_MODES:
        errors.append("invalid audio.mode")

    handoff = record.get("handoff", {})
    if state == "ready_for_edit" and not handoff.get("downstream_skill"):
        errors.append("ready_for_edit requires downstream_skill")
    if state == "ready_for_edit" and not handoff.get("must_preserve"):
        errors.append("ready_for_edit requires must_preserve constraints")

    # anti-fabrication marker: generated/synthetic match footage must never be required
    for i, clip in enumerate(footage):
        desc = (clip.get("description") or "").lower()
        if any(term in desc for term in ["synthetic match footage", "ai-generated player", "ai-generated horse"]):
            errors.append(f"footage[{i}] contains prohibited synthetic sports reality")

    return errors

def main():
    if len(sys.argv) != 2:
        print("usage: validate_reel_plan.py <plan.json>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    record = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_reel_plan(record)

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("OK")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
