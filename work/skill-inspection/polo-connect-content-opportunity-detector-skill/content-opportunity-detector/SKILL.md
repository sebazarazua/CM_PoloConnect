---
name: content-opportunity-detector
description: Decide which verified polo developments, owned assets, recurring moments, and strategic themes deserve content production for Polo Connect. Use to prioritize what to create now, choose the best content opportunity, avoid redundant publishing, assign timing and format direction, and hand off a production-ready brief without generating the final asset.
---

# Content Opportunity Detector

## Purpose

Convert verified information and available creative inputs into a prioritized editorial production queue for Polo Connect.

The skill answers:

- Is this worth producing?
- Why now?
- For whom?
- What objective does it serve?
- Which content format is best suited to the opportunity?
- What assets are required?
- How urgent is it?
- Is the feed already saturated with similar content?
- Should the idea be produced, scheduled, monitored, merged, delayed, or rejected?

It does not perform benchmark research, verify breaking claims from scratch, write final captions, design graphics, edit video, schedule posts, or publish.

## Core principles

1. Publishing is a decision, not a default outcome.
2. Editorial value comes from audience value, timing, distinctiveness, brand fit, available evidence, and production feasibility.
3. A major polo event does not automatically require another feed post if Polo Connect has already covered the same audience need.
4. The best format follows the communication job, not habit.
5. Avoid format monoculture. Reels, carousels, Stories, single-image posts, live coverage, clips, explainers, and no-post decisions are all valid.
6. Distinguish urgency from importance.
7. Prefer a smaller number of strong opportunities over a high-volume queue of weak ideas.
8. Use Polo Connect's owned/licensed access as a strategic advantage when it creates something genuinely better.
9. External benchmark patterns may inform execution direction, but they do not determine whether an opportunity deserves production.
10. Every approved opportunity must have a clear reason to exist.

## Required references

Before substantial prioritization, read:

- `references/decision-framework.md`
- `references/opportunity-types.md`
- `references/editorial-fatigue-and-diversity.md`
- `references/asset-readiness.md`
- `references/timing-and-lifecycle.md`
- `references/handoff-contract.md`

Use `assets/content-opportunity.schema.json` for machine-readable opportunity records.

## Expected upstream inputs

Prefer inputs from:

- `polo-news-researcher` for verified current events;
- `benchmark-researcher` for creative mechanisms and reference intelligence;
- Polo Connect calendar and match schedule;
- owned/licensed photo and video inventory;
- live production notes;
- product/marketing priorities;
- first-party audience/performance data when available;
- previous and scheduled social content.

If upstream verification is missing for a factual news claim, do not silently perform full verification inside this skill. Mark the opportunity `blocked_verification` and route it back to the research layer.

## Inputs

Accept one or more of:

- verified news/event records;
- upcoming matches/tournaments;
- owned media assets;
- a list of candidate ideas;
- a strategic campaign or product priority;
- a content calendar;
- recent Polo Connect posts;
- benchmark findings;
- audience/performance learnings;
- a request such as "qué deberíamos publicar hoy".

If context is incomplete, make the strongest safe decision possible and expose missing dependencies.

## Workflow

### 1. Build the candidate pool

Candidates can originate from:

- breaking or scheduled polo events;
- live match moments;
- results;
- statistics;
- player/team/horse stories;
- evergreen education;
- archive;
- behind-the-scenes;
- community interaction;
- product/platform moments;
- sponsorship obligations;
- seasonal or tournament milestones;
- benchmark-inspired creative hypotheses;
- first-party performance opportunities.

Do not treat every candidate as a future post. This stage is intentionally permissive.

### 2. Validate eligibility

Before scoring, reject or block candidates that fail hard requirements.

Possible blockers:
- central fact not verified;
- no legal/approved media path for a media-dependent concept;
- duplicate of already scheduled content with no new audience value;
- expired timing window;
- materially incomplete event context;
- production requirement impossible before value decays;
- conflict with a higher-priority editorial obligation.

Assign explicit blocker codes rather than vague "not recommended".

### 3. Define the audience job

Every opportunity must serve at least one clear audience job.

Examples:
- inform;
- explain;
- entertain;
- create anticipation;
- deliver a result;
- provide context;
- deepen fandom;
- humanize a player/team;
- showcase the horse/equestrian dimension;
- make the audience feel present at the event;
- help discover upcoming matches;
- drive viewing of a live or replay experience;
- build trust in Polo Connect as a polo media destination.

Avoid content whose only rationale is "we should stay active".

### 4. Define the strategic objective

Assign one primary objective and optional secondary objectives.

Allowed primary objectives include:
- `reach`
- `engagement`
- `retention`
- `authority`
- `community`
- `event_awareness`
- `live_viewership`
- `replay_viewership`
- `product_discovery`
- `brand_equity`
- `sponsor_delivery`

Do not optimize every piece for every objective.

### 5. Measure novelty and redundancy

Compare the candidate with:
- recent published content;
- scheduled content;
- same-event coverage;
- same subject/player/team;
- same format;
- same creative mechanism;
- same audience job.

Distinguish:
- useful repetition;
- necessary update;
- serial coverage;
- editorial fatigue;
- literal duplication.

If two candidates serve the same audience job, consider merging them.

### 6. Evaluate timing

Determine:
- value window;
- earliest useful publication time;
- latest useful publication time;
- whether the opportunity is reactive or planned;
- whether waiting improves asset quality;
- whether waiting destroys relevance.

Do not confuse "can publish now" with "should publish now".

### 7. Evaluate asset readiness

Inspect:
- owned footage;
- licensed footage;
- photos;
- scores/stats;
- quotes;
- graphics;
- logos;
- player/team/horse metadata;
- music/audio constraints;
- rights status;
- production complexity.

Prefer opportunities where Polo Connect can create something materially better because it owns the stream, footage, access, or data.

Do not approve a concept whose key asset is hypothetical unless the opportunity explicitly includes a capture plan.

### 8. Choose the content job before format

Determine what the piece must accomplish.

Then select the most suitable format.

Examples:
- immediate match moment -> short vertical clip or Story;
- multi-point explanation -> carousel;
- visually strong quote -> single image or short motion graphic;
- result with strong owned footage -> Reel or result graphic depending on urgency and asset readiness;
- dense context -> carousel or editorial post;
- low-value update -> Story only;
- trivial information -> no content.

Never default to Reel merely because Reels often reach broadly.

### 9. Use benchmark intelligence selectively

If benchmark research exists:
- attach relevant transferable mechanisms;
- do not repeat the entire benchmark analysis;
- use it to improve execution direction;
- reject mechanisms that clash with the current audience job or Polo Connect identity.

A strong benchmark reference cannot rescue a weak editorial opportunity.

### 10. Score opportunity value

Use `references/decision-framework.md`.

Scoring is a prioritization aid, not an automatic publisher.

A high score can still be blocked by rights, verification, or timing.

### 11. Assign production decision

Each candidate must end as one of:

- `produce_now`
- `produce_scheduled`
- `merge`
- `story_only`
- `monitor`
- `hold`
- `blocked_verification`
- `blocked_assets`
- `reject`

Definitions are in `references/decision-framework.md`.

### 12. Define the recommended format set

Return:
- one preferred format;
- optional fallback format;
- reason;
- required assets;
- production complexity;
- expected shelf life.

Do not provide five equivalent format options. Make a decision.

### 13. Define the content angle

Write a concise editorial angle, not final copy.

The angle should explain:
- the audience promise;
- the point of view;
- the key information/emotion;
- what makes this version specifically Polo Connect.

Bad:
- "Post about the final."

Good:
- "Use Polo Connect's own final-seconds footage to make the decisive goal the story; reveal the result immediately, then add the match context."

### 14. Run fatigue/diversity checks

Before finalizing the queue, inspect:
- format distribution;
- topic repetition;
- player/team overexposure;
- excessive result/news density;
- excessive brand/product promotion;
- visual sameness;
- repetitive CTAs;
- repeated hook structures.

Diversity is not random variety. It should improve audience value while preserving editorial coherence.

### 15. Build the queue

Sort approved opportunities by:
1. hard timing constraints;
2. editorial priority;
3. production readiness;
4. strategic importance;
5. fatigue management.

Do not simply sort by numeric score.

### 16. Produce the handoff

For every approved opportunity, provide:
- decision;
- priority;
- timing;
- primary objective;
- audience job;
- preferred format;
- editorial angle;
- required facts;
- required assets;
- benchmark mechanisms if applicable;
- brand/rights constraints;
- production notes;
- success signals;
- downstream skill target.

The handoff must be sufficient for the next production skill to work without re-deciding the strategy.

## Hard gates

Never approve production when:
- the central factual premise is unverified;
- the concept requires rights Polo Connect does not have and no lawful alternative exists;
- the timing window has expired with no evergreen value;
- the content duplicates an existing piece without meaningful new value;
- the only rationale is platform activity;
- the opportunity conflicts with a correction, legal restriction, or known factual uncertainty.

## Quality bar

A successful result should make it obvious why each approved piece deserves to exist and why rejected pieces do not.

If the queue contains many items with interchangeable rationales, the prioritization is too weak.
