---
name: benchmark-researcher
description: Research and analyze approved social-media benchmark accounts and posts to extract evidence-backed creative patterns that can be adapted to Polo Connect without copying. Use for benchmark audits, reference mining, creative inspiration, and pre-production research for social content.
---

# Benchmark Researcher

## Purpose

Turn external social-media references into reusable creative intelligence for Polo Connect.

The skill studies approved benchmark accounts and individual posts, identifies why specific content appears effective, separates observable facts from inference, and translates useful mechanisms into original directions for Polo Connect.

It is not a content generator, a brand-style replacement, or a competitor-copying workflow.

## Core principles

1. Treat all approved benchmark accounts as one flexible reference pool. Never assign permanent roles such as "use account X only for graphics" or "account Y only for tone".
2. Analyze posts, not reputations. A useful reference is an individual piece of content supported by evidence and context.
3. Extract mechanisms, not surfaces. Learn from hierarchy, pacing, framing, information density, emotional structure, edit logic, hooks, sequencing, copy mechanics, community behavior, and other transferable principles.
4. Polo Connect must remain recognizably Polo Connect. External references are inputs, never templates.
5. Prefer evidence over intuition. Clearly label what is observed, measured, inferred, unavailable, or uncertain.
6. Never invent hidden metrics, audience data, algorithmic causes, or performance explanations.
7. Performance does not equal quality and quality does not equal transferability. Judge both separately.
8. Use current platform behavior as a prior, not a permanent rule. Revalidate assumptions against live evidence and Polo Connect's own results when available.

## Required references

Before substantial analysis, read:

- `references/benchmark-pool.md`
- `references/analysis-framework.md`
- `references/evidence-and-metrics.md`
- `references/transfer-and-originality.md`

Read `references/platform-state-2026.md` when platform behavior, format selection, timing, or performance interpretation matters.

Use `assets/benchmark-record.schema.json` when producing machine-readable benchmark records.

## Inputs

Accept one or more of:

- a content objective;
- a topic, event, match, player, horse, tournament, product, announcement, or campaign;
- a desired output format such as Reel, carousel, feed post, Story, or graphic;
- one or more benchmark accounts or posts;
- a time window;
- a request for broad benchmark discovery;
- a Polo Connect asset, draft, or creative brief that needs reference research.

If the request is broad, define the smallest useful research frame yourself. Do not block progress for optional details.

## Workflow

### 1. Define the research question

Translate the request into a concrete question.

Examples:
- Which recent sports Reels use an opening that could improve a Polo Connect match highlight?
- Which graphic systems communicate a final score clearly without looking generic?
- How do premium sports brands make tradition feel contemporary?
- Which reference patterns could make a player announcement more shareable?

State the question internally before collecting examples.

### 2. Establish the evidence window

Choose a window that matches the task.

Default behavior:
- use recent material for platform-native conventions;
- include older standout material only when it demonstrates a durable creative principle;
- avoid conclusions based only on one viral outlier;
- compare like with like when possible: Reel vs Reel, carousel vs carousel, breaking news vs breaking news, event coverage vs event coverage.

Record the observation date because public metrics change over time.

### 3. Verify source identity

Before relying on a benchmark account:
- verify that the handle currently resolves to the intended organization;
- detect renamed, duplicate, inactive, unofficial, fan, or impersonation accounts;
- do not silently substitute a different account;
- record canonical handle and verification status.

The approved list is a discovery whitelist, not proof that every stored handle remains current forever.

### 4. Collect a balanced sample

For each research question, prefer a sample containing:
- recent relevant posts;
- comparatively strong performers when public metrics permit;
- representative baseline posts from the same account;
- more than one account when the creative principle is claimed to generalize.

Do not select only the highest-like posts. That creates survivorship bias.

When available, collect enough posts to distinguish a repeatable pattern from a one-off execution. If access limits prevent this, lower confidence rather than pretending the sample is complete.

### 5. Capture observable attributes

For each post, record only what can actually be observed or sourced:

**Context**
- account;
- URL or stable identifier;
- publication date/time;
- observation date/time;
- platform;
- format;
- topic;
- event context.

**Creative construction**
- first-frame or first-slide behavior;
- hook;
- visual hierarchy;
- composition;
- crop/framing;
- photography/video treatment;
- typography behavior;
- information density;
- color behavior;
- motion/editing;
- pacing;
- shot sequence;
- subtitles/text overlays;
- audio role;
- caption structure;
- CTA;
- brand presence;
- sponsor presence;
- use of talent/athletes/animals;
- emotional mechanism;
- community or meme mechanics;
- use of archive, live footage, statistics, graphics, or behind-the-scenes material.

Describe mechanisms neutrally. Do not write "good design" when the actual observation is "single dominant image, one-line headline, strong negative space, no secondary copy."

### 6. Capture performance evidence

Use public or authorized metrics only.

Store:
- metric name;
- value;
- source;
- observation time;
- whether it is public, authorized first-party, calculated, or estimated by a third party;
- formula when calculated.

Never infer unavailable reach, saves, shares, retention, watch time, completion rate, profile actions, or follower conversion for external accounts.

Do not compare raw likes across differently sized accounts without context.

When using competitor engagement, keep the calculation definition attached to the record. Do not compare a follower-based competitor engagement rate with Polo Connect's reach-based first-party engagement as if they were identical.

### 7. Normalize before ranking

When sufficient data exists, compare a post against:
1. its own account baseline;
2. the same content format;
3. a reasonably similar time window;
4. the account's approximate audience size at observation;
5. event magnitude when it materially distorts performance.

Prefer relative statements:
- "2.1× the account's median comments for comparable Reels"
over:
- "this is objectively a top-performing Reel."

If the baseline is unavailable, state that the performance signal is incomplete.

### 8. Analyze why the reference may work

Separate three layers:

**Observed**
What is directly visible or measured.

**Interpretation**
A plausible explanation supported by the observations.

**Confidence**
High, medium, or low, based on sample size and evidence quality.

Do not claim algorithmic causality. Use language such as "likely contributes", "consistent with", or "worth testing" unless causal evidence exists.

### 9. Abstract transferable mechanisms

Convert useful observations into principles independent of the source brand.

Bad:
- "Use the TyC layout."
- "Make it look like 433."

Good:
- "Lead with one dominant action frame; move context to a compact secondary line."
- "Reveal the score before explanatory copy because the audience's first question is outcome."
- "Open the Reel on peak action, then backfill context instead of using a title intro."
- "Use the horse and rider as the visual subject; keep sponsor and tournament information subordinate."

A principle must be understandable without seeing the original reference.

### 10. Synthesize across references

Prefer synthesis from multiple compatible references.

A Polo Connect direction may combine:
- information hierarchy observed in one post;
- pacing observed elsewhere;
- a caption mechanism from a third source;
- Polo-specific subject matter and owned footage;
- Polo Connect's own visual system.

Never create a collage of recognizable brand signatures.

### 11. Translate into Polo Connect opportunities

For each useful pattern, produce:
- the transferable mechanism;
- why it is relevant to the current Polo Connect objective;
- how it could be executed with Polo Connect-owned or licensed material;
- what must remain unique to Polo Connect;
- production requirements;
- risks or constraints;
- testable hypothesis.

Do not generate the final post unless another skill or explicit user request asks for production.

### 12. Score reference utility

Use the scoring model in `references/analysis-framework.md` only to prioritize research findings, not to claim objective creative quality.

Never hide uncertainty behind a numeric score.

### 13. Produce the research output

For a focused request, return:
1. Research question.
2. Best references.
3. Evidence.
4. Transferable mechanisms.
5. Polo Connect applications.
6. Risks / anti-copy notes.
7. Recommended experiments.
8. Confidence and evidence gaps.

For dataset workflows, additionally emit records conforming to `assets/benchmark-record.schema.json`.

## Anti-copy gate

Reject or transform any direction that:
- reproduces a distinctive layout substantially unchanged;
- copies caption wording, slogan, headline, sequence, or visual gimmick too closely;
- uses another brand's logo, typography identity, proprietary graphic device, or watermark as if it belonged to Polo Connect;
- depends on copyrighted media Polo Connect does not own or license;
- would make a reasonable viewer think the piece was produced by the reference brand.

When a request is too derivative, preserve the underlying communication objective and redesign the mechanism from first principles.

## Evidence gate

Before finalizing research, confirm:
- every factual performance claim has a source;
- unavailable metrics are marked unavailable;
- inference is not presented as fact;
- sample limitations are disclosed;
- current handles were verified or explicitly marked unverified;
- performance comparisons use compatible denominators;
- no hidden metric has been reconstructed from unsupported assumptions.

## Quality bar

A successful benchmark analysis should make a creative team capable of producing an original Polo Connect execution without needing to imitate the reference.

If the output is mostly account names, adjectives, screenshots, or "do something similar", the analysis is incomplete.
