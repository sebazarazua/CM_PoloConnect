# Accessibility and platform preflight

## Accessibility review

### Graphics
- readable type;
- adequate contrast;
- clear reading order;
- essential meaning not color-only;
- data values labeled.

### Video
- subtitles for meaningful speech when needed;
- text remains on screen long enough;
- no essential information only in audio;
- no subtitle collision with UI/action.

### Alt text
If supported and used:
- factual;
- concise;
- matches final render;
- no keyword stuffing.

## Technical preflight

For exact route, check current:
- media container;
- codec;
- aspect;
- dimensions;
- duration;
- frame rate if constrained;
- file size;
- carousel count;
- image/video combination support;
- thumbnail/cover;
- caption/metadata;
- alt-text support;
- music restrictions;
- account permissions.

## Route-specific principle

`Instagram app`, `Meta API`, `Metricool`, and other schedulers may not accept identical payloads.

Validate against the actual route.

## Preview review

Where possible inspect:
- feed preview;
- grid/profile crop;
- Reel cover;
- Story UI overlap;
- carousel first card.

## Technical quality

Check:
- compression artifacts;
- audio clipping;
- black frames;
- wrong orientation;
- subtitle burn-in;
- missing fonts;
- color shifts;
- image blur.

## Stale spec rule

Never approve solely because a file matches an old "Instagram size guide."

Current route validation wins.
