# Instagram graphic output — reviewed 2026-10-24

This file is time-sensitive. Verify current Instagram/Meta requirements at export and publishing time.

## Current working observations

As of October 2026:
- Instagram supports portrait feed imagery beyond the older square-only conventions.
- 4:5 portrait remains a broadly compatible production default across many feed/scheduler workflows.
- Native Instagram may support taller 3:4 photo presentation.
- Carousel cards should be designed with a consistent orientation unless the current publishing route explicitly supports otherwise.
- The Instagram app may allow more carousel items than some API/scheduler publishing routes.
- API-based publishing can impose different media requirements from the native app.
- Meta's publishing API supports alt text for image publishing paths in current documentation.

## Recommended operational default

For automated Polo Connect production:
- design portrait-first;
- use a 4:5-safe composition when the publishing route is not yet known;
- preserve a crop-resilient central focal area;
- verify current carousel item limits for the exact publishing route;
- verify current supported file types and media constraints before export.

## Why this is not hardcoded in core design logic

Instagram display and API behavior changes.

The durable design plan should specify:
- aspect intent;
- crop priorities;
- safe focal region;
- slide structure;
- export surface.

The rendering/publishing layer should resolve exact pixels, file formats, and carousel limits from current platform/tool requirements.

## Carousel count

Do not design to the platform maximum.

Use the shortest sequence that communicates the story.

If native app and API limits differ, the automated publishing route is the controlling operational limit.

## Grid/feed crop

Profile grid and feed surfaces can crop or preview differently.

Test:
- hero subject;
- score;
- headline;
- logo

against current publishing preview.

## Stories

Use vertical full-screen composition and validate current UI overlays/sticker areas at render time.

## Accessibility

Where current publishing tools/API support image alt text, include it in the final handoff.
