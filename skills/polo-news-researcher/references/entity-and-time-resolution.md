# Entity and time resolution

## Entity normalization

For each entity store:
- canonical name;
- source variants;
- entity type;
- country/club/team relation if useful;
- stable ID when an authoritative system exposes one.

Entity types may include:
- player
- team
- horse
- tournament
- club
- venue
- governing_body
- sponsor
- broadcaster
- organizer

Do not merge based on fuzzy name similarity alone.

## Team naming

Sponsors and naming rights change.

Preserve:
- current event-specific team name;
- stable team identity when known;
- sponsor/name variant.

Do not rewrite historical names to current sponsor names.

## Player identity

Watch for:
- Jr./Sr.;
- nicknames;
- accents;
- initials;
- family members with similar names.

## Horse identity

Horse names can be ambiguous and may lack stable public identifiers.

Use cautious matching and include owner/player/event context when needed.

## Date resolution

Store ISO 8601 values when possible.

For relative language:
- resolve against the source's publication/update time;
- preserve original wording in provenance if ambiguity matters.

## Time zones

For fixtures:
- preserve venue-local time;
- store timezone when known;
- convert only for presentation, never overwrite the source-local value.

## Event chronology

A story can have:
- occurrence date;
- announcement date;
- publication date;
- correction/update date.

Editorial freshness should be based on what changed, not just when a page was indexed or crawled.

## Current vs historical relevance

Historical material becomes current only when there is a present trigger:
- anniversary;
- record broken;
- player milestone;
- upcoming rematch;
- archival footage release;
- current comparison.

Do not label an old event as breaking news because a new article republishes it.
