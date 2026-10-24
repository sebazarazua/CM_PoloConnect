# Review protocol

## Independence

The reviewer evaluates delivered work against approved inputs.

It should not defend the choices made by the creating skill.

## Review modes

### `full`
All required records and final assets are available.

### `partial`
Some inputs are missing.

### `delta`
A previous review exists and only specified changes need rechecking.

Record mode explicitly.

## Evidence sources

Review evidence can include:
- structured upstream records;
- rendered image;
- rendered video;
- audio;
- captions/subtitles;
- rights metadata;
- sponsor brief;
- platform preflight result;
- screenshots/previews;
- publishing route metadata.

## Observation vs judgment

Separate:
- observed defect;
- rule/requirement;
- editorial judgment.

Example:

Observed:
"Team A score reads 12 in the image and 13 in the caption."

Rule:
"All output surfaces must match the verified result."

Decision:
"Block publication."

## Review order

Use:
1. source-of-truth;
2. factual consistency;
3. rights/compliance;
4. strategic alignment;
5. content quality;
6. accessibility;
7. platform readiness;
8. final decision.

This order prevents spending time polishing content that cannot legally or factually ship.

## Reviewer restraint

Do not convert personal preference into defects.

A different crop, font size, or caption rhythm is not an issue unless it violates:
- strategy;
- readability;
- brand system;
- platform behavior;
- factual clarity;
- established quality bar.

## One issue per root cause

Avoid duplicate QA noise.

Bad:
- "score wrong in headline"
- "score wrong in caption"
- "score wrong in alt text"

when all derive from one incorrect source-of-truth value.

Use one root-cause issue plus affected surfaces unless separate owners/fixes are needed.
