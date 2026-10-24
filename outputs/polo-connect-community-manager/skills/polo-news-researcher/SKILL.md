---
name: polo-news-researcher
description: "Research, verify, deduplicate, prioritize, and structure current polo news, results, schedules, rankings, announcements, and emerging stories for Polo Connect. Use when discovering what is happening in polo, validating a claim, building an editorial news queue, or preparing verified context before content creation."
---

# Polo News Researcher

## Purpose

Produce a reliable, current editorial intelligence layer for Polo Connect.

The skill finds relevant developments across the polo ecosystem, verifies what actually happened, distinguishes official facts from reporting and rumor, resolves dates and entities, removes duplicate coverage, and ranks stories by editorial value and urgency.

It does not write the final social post, design creative assets, publish content, or manufacture narratives unsupported by evidence.

## Core principles

1. Freshness is part of accuracy. Always distinguish publication date, event date, scheduled date, and observation time.
2. Prefer primary evidence when it exists, but do not ignore specialist reporting that adds earlier or richer context.
3. Source authority is contextual. The best source for an official tournament schedule may differ from the best source for an interview, transfer, horse story, ranking, or breaking development.
4. Never convert repetition into confirmation. Ten articles repeating one unsupported claim still represent one evidentiary origin.
5. Separate confirmed fact, reported fact, inference, claim, rumor, and unknown.
6. Resolve conflicts explicitly. Do not silently select whichever version appears first.
7. Deduplicate stories at the event level, not just by URL or headline.
8. Editorial value is not the same as factual importance. Rank both.
9. Polo Connect-owned data, live production information, and licensed match feeds are first-party evidence when authorized.
10. The skill must be useful to editors: every surfaced story needs enough provenance to decide whether to publish, monitor, or ignore.

## Required references

Before substantial research, read:

- `references/source-strategy.md`
- `references/verification-protocol.md`
- `references/editorial-prioritization.md`
- `references/entity-and-time-resolution.md`
- `references/rights-and-attribution.md`

Read `references/source-registry-2026.md` when choosing external sources or validating current coverage.

Use `assets/news-event.schema.json` for machine-readable records.

## Inputs

Accept one or more of:

- a broad request such as "what matters in polo today";
- a tournament, player, team, horse, club, organization, country, or competition;
- a claim requiring verification;
- a time window;
- a request for results, fixtures, rankings, signings, injuries, announcements, interviews, or other developments;
- an editorial objective such as finding publishable stories for Instagram;
- first-party Polo Connect match or production data.

If scope is broad, choose a useful research horizon and state it. Do not ask for optional details if the task can be completed responsibly.

## Workflow

### 1. Define the research frame

Establish:
- topic scope;
- geography if relevant;
- time window;
- target audience;
- whether the task is discovery, verification, monitoring, or editorial prioritization.

For "today", "latest", "now", or similar requests, resolve the current local date/time before evaluating freshness.

### 2. Discover candidate developments

Search across an appropriate mix of:
- official governing bodies;
- tournament organizers;
- clubs;
- teams;
- players and other direct participants;
- specialist polo media;
- trusted sports media;
- ranking/data sources;
- Polo Connect first-party systems when authorized.

Use broad discovery first, then open the strongest candidate sources.

Do not rely on a single search result snippet for a material claim when the underlying page can be inspected.

### 3. Resolve the underlying event

Convert coverage into an event-level record.

Examples:
- a match result;
- a fixture change;
- a tournament announcement;
- a player/team change;
- a ranking update;
- an injury;
- a horse-related story;
- an interview statement;
- a disciplinary or regulatory action;
- a venue/ticketing/logistics update;
- a rights/broadcast announcement;
- a historical milestone that became relevant now.

Multiple URLs about the same occurrence belong to one event.

### 4. Resolve entities

Normalize names for:
- players;
- teams;
- clubs;
- tournaments;
- governing bodies;
- venues;
- horses;
- sponsors when material.

Preserve aliases and source spelling, but maintain a canonical internal representation.

Do not merge entities solely because names look similar.

### 5. Resolve dates and chronology

For every event, distinguish where applicable:
- `event_started_at`;
- `event_ended_at`;
- `scheduled_for`;
- `announced_at`;
- `published_at`;
- `updated_at`;
- `observed_at`.

If a source says "today", "tomorrow", "this Saturday", or similar, convert it to an absolute date using the source publication context.

If the event date and article publication date differ, editorial freshness follows the event and update chronology, not the article timestamp alone.

### 6. Classify every claim

Use the evidence model in `references/verification-protocol.md`.

A story may contain several claims with different statuses.

Example:
- match score: confirmed;
- player quote: confirmed;
- reason for lineup change: reported;
- speculation about next tournament: rumor.

Never assign one blanket confidence label to all claims when the evidence differs.

### 7. Trace provenance

For each material claim:
- identify the earliest available origin when practical;
- distinguish original reporting from republishing;
- record primary source if available;
- detect circular citation.

Do not count syndicated or copied articles as independent corroboration.

### 8. Corroborate proportionally to risk

Use stronger verification when the claim is:
- reputation-sensitive;
- injury/health-related;
- disciplinary;
- contractual;
- financial;
- controversial;
- based on anonymous sourcing;
- surprising or inconsistent with official records.

Routine low-risk facts such as an official published fixture may require only a strong primary source.

### 9. Resolve conflicts

When sources disagree:
1. identify the exact disputed field;
2. compare source proximity, authority, timestamp, and update history;
3. search for a newer or primary clarification;
4. preserve unresolved alternatives if necessary;
5. lower confidence rather than inventing reconciliation.

Do not merge incompatible scores, dates, lineups, or quotes.

### 10. Deduplicate

Group candidate items into a single event when they share the same underlying occurrence.

Use:
- entities;
- tournament;
- match;
- date/time;
- score;
- quoted statement;
- announcement;
- source links.

Keep all useful sources attached to the canonical event.

### 11. Evaluate editorial value

Score using `references/editorial-prioritization.md`.

Consider:
- significance to polo;
- relevance to Polo Connect's audience;
- timeliness;
- exclusivity/proximity;
- visual potential;
- conversation potential;
- utility;
- confidence;
- rights feasibility.

Do not allow virality potential to compensate for weak verification.

### 12. Assign action state

Every event should end in one of:

- `publish_now`
- `prepare`
- `monitor`
- `background_only`
- `reject`

Definitions:
- `publish_now`: verified, timely, relevant, and editorially actionable.
- `prepare`: verified but tied to a future moment or requires production work.
- `monitor`: potentially relevant but evidence or timing is incomplete.
- `background_only`: useful context, not a standalone story.
- `reject`: false, stale without renewed relevance, duplicative with no added value, materially unverifiable, or outside scope.

### 13. Identify content opportunities

For actionable events, describe editorial angles without writing final copy.

Examples:
- breaking update;
- result;
- preview;
- player focus;
- stat-led story;
- explainer;
- quote-led post;
- historical context;
- horse story;
- behind-the-scenes;
- live follow-up;
- carousel opportunity;
- Reel opportunity.

Angles must be supported by the verified event, not invented for engagement.

### 14. Record rights/attribution constraints

Before recommending use of source media:
- identify whether Polo Connect owns or licenses the footage/photo;
- distinguish fact usage from media reuse;
- retain photographer/source credit requirements when known;
- never assume that publicly visible media is reusable.

### 15. Produce output

For a focused verification:
1. Verdict.
2. Confirmed facts.
3. Unconfirmed/disputed points.
4. Best sources.
5. Timeline.
6. Confidence.
7. Editorial recommendation.

For a news queue:
1. Highest-priority events.
2. Action state.
3. What happened.
4. Why it matters.
5. Evidence/confidence.
6. Best editorial angles.
7. Required assets/data.
8. Rights/attribution notes.
9. Follow-up trigger.

For machine workflows, also emit records conforming to `assets/news-event.schema.json`.

## Hard gates

Do not surface an item as `publish_now` when:
- the central claim remains rumor or unsupported;
- dates/entities cannot be resolved sufficiently;
- the only source is circular republication;
- a material conflict remains unresolved;
- the story is stale and has no current relevance;
- the recommendation depends on media rights that are known to be unavailable.

## Quality bar

A successful output lets an editor answer, without re-researching:
- What happened?
- When did it actually happen?
- Who is involved?
- How do we know?
- What is still uncertain?
- Why should Polo Connect care?
- Should we publish now, prepare, monitor, or ignore?
- What can we legally and credibly use?
