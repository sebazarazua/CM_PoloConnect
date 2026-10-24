---
name: reel-planner
description: Turn an approved Polo Connect content opportunity into a professional Instagram Reel production plan using real owned/licensed footage. Use for hook design, footage selection, shot order, pacing, on-screen text, subtitles, audio direction, cover strategy, rights checks, and editor handoff. Do not use for final video editing, final caption writing, news verification, or deciding whether the opportunity should exist.
---

# Reel Planner

## Purpose

Convert an approved content opportunity into an executable Reel plan that preserves the authenticity, speed, emotion, and editorial value of real polo footage.

The skill decides:
- what footage matters;
- what the viewer sees first;
- what information appears and when;
- how the story develops second by second;
- how much context is necessary;
- what should be removed;
- how overlays and subtitles behave;
- how audio supports the moment;
- how the cover should communicate the story;
- what rights/brand/sponsor constraints apply;
- what the editor must deliver.

It does not:
- verify facts from scratch;
- decide whether the content opportunity is worth producing;
- write the final Instagram caption;
- synthesize fake match footage;
- invent players, horses, venues, scores, commentary, or crowd reactions;
- perform final editing/export/publishing.

## Core principles

1. Real footage leads. Polo Connect's cameras, licensed streams, interviews, match audio, horses, players, venues, and atmosphere are the primary creative material.
2. Start with audience value, not branding. A Polo Connect logo is not a hook.
3. Open on the strongest truthful moment whenever the opportunity allows it.
4. Context should arrive only when needed to understand or intensify the moment.
5. Do not turn every sports clip into a hyper-edited montage. Editing intensity must match the story.
6. Preserve the physicality of polo: speed, horse movement, field scale, contact, sound, reaction, and spatial continuity.
7. On-screen text must clarify, not duplicate what the viewer already sees.
8. Silence, natural sound, commentary, music, and crowd audio are all valid tools. Music is not mandatory.
9. Rights are part of creative planning, not a post-production afterthought.
10. Every Reel needs one primary audience promise.
11. Do not imitate a benchmark's recognizable edit package. Transfer mechanisms, not branded expression.
12. A technically polished Reel that hides the decisive moment behind an intro is a strategic failure.
13. Keep platform-specific export constraints refreshable and separate from durable editorial logic.

## Required references

Before substantial planning, read:

- `references/reel-story-architecture.md`
- `references/footage-selection.md`
- `references/hooks-and-retention.md`
- `references/text-subtitles-and-accessibility.md`
- `references/audio-and-rights.md`
- `references/cover-and-packaging.md`
- `references/editor-handoff.md`

Read `references/platform-output-2026.md` when planning framing, safe zones, duration, export, cover, or publication constraints.

Use `assets/reel-plan.schema.json` for machine-readable plans.

## Expected upstream input

Prefer an approved `content-opportunity-detector` handoff containing:

- primary objective;
- audience job;
- editorial angle;
- required facts;
- timing/expiry;
- preferred format = Reel;
- required assets;
- rights constraints;
- benchmark mechanisms if relevant;
- success signal;
- learning hypothesis.

If the opportunity itself is not approved, do not silently approve it here.

If material facts are unverified, route back to `polo-news-researcher`.

If required footage is missing, return a capture/request plan or `blocked_assets` rather than inventing content.

## Inputs

Accept one or more of:

- approved opportunity record;
- raw match clip list;
- timecoded footage;
- livestream/replay file inventory;
- interview footage/transcript;
- still images when mixed media is justified;
- commentary/audio tracks;
- statistics;
- event context;
- benchmark mechanisms;
- brand/sponsor constraints.

## Workflow

### 1. Restate the Reel job

Define in one sentence:

> The viewer should [feel/understand/do X] because [the Reel reveals Y].

Examples:
- "The viewer should feel the shock of the winning goal because we open on the decisive play and reveal the score immediately after."
- "The viewer should understand why this final matters because the Reel compresses the rivalry into three visual beats before the match CTA."

If this cannot be stated clearly, the plan is not ready.

### 2. Confirm factual and rights constraints

Before selecting footage:
- confirm required score, names, tournament stage, date, team/player/horse identity;
- identify owned/licensed/permission-cleared assets;
- identify restricted or uncertain material;
- note sponsor/league/broadcast obligations;
- note music/commentary usage rights.

Do not plan around footage that is unavailable or uncleared unless explicitly marked as a capture dependency.

### 3. Inventory usable material

Create a compact shot inventory.

For each candidate shot/clip record:
- source file/id;
- timecode in/out;
- content;
- shot type;
- technical quality;
- editorial value;
- emotional value;
- contextual value;
- uniqueness;
- rights state;
- audio value;
- whether it can open the Reel.

Do not select shots only because they are visually beautiful. The strongest shot is the one that best serves the Reel job.

### 4. Identify the primary moment

Choose the one moment the Reel cannot afford to bury.

Possible primary moments:
- goal;
- save;
- collision/contact;
- horse acceleration;
- reaction;
- trophy lift;
- quote;
- reveal;
- stat;
- crowd/venue moment;
- pre-match tension.

The plan should still make sense if everything non-essential is removed around this moment.

### 5. Choose hook strategy

Use the hook taxonomy in `references/hooks-and-retention.md`.

A hook may be:
- peak action;
- immediate result;
- unresolved visual;
- strong reaction;
- high-stakes text;
- surprising stat;
- quote;
- visual transformation;
- atmosphere;
- contradiction/question only when genuinely useful.

Do not default to:
- logo animation;
- "POV";
- generic rhetorical question;
- slow title card;
- "wait for it";
- exaggerated clickbait.

### 6. Set narrative architecture

Choose the lightest structure that serves the content.

Examples:
- `peak -> context -> replay -> reaction`
- `setup -> tension -> decisive moment -> consequence`
- `stat -> evidence -> payoff`
- `quote -> visual proof -> context`
- `arrival -> atmosphere -> match -> emotion`
- `result -> how it happened -> what it means`

The architecture must be understandable without narration unless narration is intentionally part of the plan.

### 7. Build a timecoded beat sheet

Plan by beats, not arbitrary cuts.

For each beat define:
- target time range;
- visual;
- source/timecode;
- narrative function;
- on-screen text;
- audio;
- transition logic;
- must-keep vs optional.

Use approximate timing. The editor may shift frames for rhythm while preserving function.

Do not overspecify every 0.1 second unless timing is critical to a sync or reveal.

### 8. Control pacing

Pacing should reflect:
- action intensity;
- information density;
- source shot quality;
- emotional arc;
- target duration.

Fast cuts are not automatically modern.

Allow a strong shot to breathe when:
- scale matters;
- horse movement is visually rich;
- reaction carries emotion;
- commentary/natural sound adds meaning.

Use faster compression when:
- context can be summarized;
- repeated angles add no value;
- there is dead time;
- the Reel depends on escalation.

### 9. Preserve spatial and sporting comprehension

For match action:
- keep enough sequence to understand ball/rider/horse movement;
- avoid cutting so aggressively that viewers lose the play;
- use replay/alternate angle only if it adds clarity or emotion;
- avoid effects that obscure the ball, player, horse, score, or field.

Editorial clarity outranks flashy editing.

### 10. Plan on-screen text

Use text only for:
- essential context;
- names;
- score;
- stage/tournament;
- timing;
- stat;
- quote;
- CTA when strategically required.

Text should not narrate every visible action.

Define:
- exact wording or placeholder;
- hierarchy;
- appearance timing;
- duration;
- placement intent;
- whether text persists across cuts.

Final graphic styling belongs to design/editing systems.

### 11. Plan subtitles

If meaningful speech/commentary is included:
- subtitle accurately;
- preserve speaker meaning;
- use readable line lengths;
- avoid covering essential sporting action;
- distinguish multiple speakers when necessary;
- do not subtitle irrelevant ambient chatter.

For fast sports commentary, edit subtitles for readability without changing meaning.

### 12. Plan audio

Choose primary audio mode:

- `natural_sound_led`
- `commentary_led`
- `music_led`
- `voiceover_led`
- `hybrid`

State why.

Preserve valuable:
- hoofbeats;
- stick/ball contact;
- crowd reaction;
- whistle;
- player reaction;
- live commentary.

Do not bury authentic audio under generic music if authentic sound is the stronger asset.

### 13. Music strategy

When music is useful:
- define mood/energy/tempo, not an unlicensed song unless usage is cleared;
- design cuts so the Reel can survive music substitution;
- note whether source audio must remain audible;
- avoid trend-chasing that makes premium sports footage feel disposable.

If a trend sound is strategically relevant, treat it as optional until rights/platform availability are confirmed.

### 14. Plan benchmark mechanism use

If upstream benchmark research exists:
- attach only the mechanisms relevant to this Reel;
- explain how they are reinterpreted;
- avoid copying another account's intro, typography package, sound design signature, or shot sequence.

### 15. Define brand presence

Branding should be sufficient for attribution without weakening the hook.

Possible brand presence:
- subtle watermark/bug;
- score package;
- end card;
- branded lower third;
- cover design;
- natural product UI only when strategically relevant.

Do not force an intro bumper.

### 16. Define CTA behavior

A CTA is optional.

Use only when tied to the opportunity objective.

Examples:
- watch live;
- watch replay;
- follow for tournament coverage;
- comment/predict when discussion is genuinely useful;
- open Polo Connect for stats.

Do not append generic engagement bait.

### 17. Define cover strategy

The cover must work as:
- a feed/grid object;
- a story label;
- a fast visual summary.

Choose:
- hero frame;
- headline if needed;
- score/result if relevant;
- player/horse visibility;
- logo/brand level;
- crop-safe focal point.

Do not design a separate poster that misrepresents the actual Reel.

### 18. Run authenticity / AI-look gate

Reject directions that depend on:
- synthetic player/horse imagery;
- fake stadium atmosphere;
- generated crowd;
- unrealistic sports action;
- pseudo-cinematic AI footage;
- artificial commentary presented as real;
- overprocessed visuals that make documentary footage look generated.

AI-assisted cleanup or technical enhancement must not change factual content.

### 19. Run retention sanity check

Before handoff ask:
- Is the strongest moment shown early enough?
- Is there any intro that can be deleted?
- Does every beat add information, emotion, tension, or payoff?
- Is context repeated?
- Is text competing with action?
- Is the Reel longer than the story requires?
- Does the ending deliver consequence or simply stop?

Shorten when additional duration adds no audience value.

### 20. Create editor handoff

Deliver:
- Reel job;
- target duration range;
- aspect/framing intent;
- source clip/timecode map;
- beat sheet;
- hook;
- overlays;
- subtitle plan;
- audio plan;
- brand/sponsor constraints;
- cover direction;
- CTA;
- rights notes;
- benchmark mechanisms;
- optional vs must-have shots;
- export/publish checks;
- success signal.

The editor should be able to begin without re-deciding the narrative.

## Decision states

Return one:

- `ready_for_edit`
- `ready_with_capture_request`
- `blocked_assets`
- `blocked_verification`
- `blocked_rights`
- `replan_required`

Do not use `ready_for_edit` when a central footage, fact, or rights dependency remains unresolved.

## Hard gates

Never approve a Reel plan that:
- fabricates match footage or documentary reality;
- uses uncleared third-party media as if reusable;
- relies on an unverified result/name/stat;
- begins with branding when the content has a stronger truthful hook;
- copies a benchmark's recognizable edit identity;
- obscures horses/players/ball with unnecessary effects;
- sacrifices sporting comprehension for cut speed;
- requires a copyrighted track without a permitted usage path;
- contains a deceptive cover or headline.

## Quality bar

A successful Reel plan should let a skilled editor produce a polished, modern Polo Connect Reel using authentic material while understanding exactly:
- what matters;
- what to show first;
- what to remove;
- what the viewer should feel/learn;
- how the edit supports that;
- which elements are mandatory;
- which elements remain creative freedom.

If the plan reads like a generic social-video checklist, it is not finished.
