# Timing and lifecycle

## Timing classes

### `live`
Value decays within minutes.

### `reactive`
Value decays within hours.

### `same_day`
Useful through the event day.

### `scheduled`
Best at a known future time.

### `evergreen`
Low decay, can be optimized for quality.

### `seasonal`
Tied to tournament phase, anniversary, or recurring calendar moment.

## Opportunity lifecycle

Every opportunity can move through:

`detected -> eligible -> prioritized -> in_production -> ready -> published -> measured`

Or exit through:
- `merged`
- `expired`
- `rejected`
- `blocked`

This skill owns only:
`detected -> eligible -> prioritized`

Downstream systems own production and publication.

## Expiry

Set an explicit `expires_at` when relevance decays.

Examples:
- breaking lineup change: short expiry;
- final result: hours, depending on coverage;
- preview: expires at match start;
- educational carousel: may have no hard expiry.

## Timing conflicts

When multiple P0/P1 opportunities collide:
1. protect factual live utility;
2. protect exclusive material;
3. avoid simultaneous posts that cannibalize the same audience need;
4. move secondary updates to Stories;
5. delay evergreen content.

## Planned moments

The detector should proactively surface opportunities before:
- match start;
- semifinal/final;
- draw;
- ranking update;
- tournament launch;
- replay release;
- anniversary/milestone;
- sponsor activation.

A good CM does not only react.
