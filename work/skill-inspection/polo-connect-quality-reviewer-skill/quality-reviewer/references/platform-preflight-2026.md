# Platform preflight — reviewed 2026-10-24

This file intentionally avoids fragile hardcoded limits.

## Current operating model

Polo Connect may publish through:
- Instagram native app;
- Meta's Instagram publishing API;
- Metricool or another scheduler.

These routes can differ in:
- accepted media;
- carousel behavior;
- audio handling;
- cover/thumbnail handling;
- alt text;
- permissions;
- processing;
- scheduling constraints.

## QA rule

At `pre_publish`, the quality reviewer must obtain or verify current technical requirements for the exact route.

Do not approve based on memory of:
- old aspect limits;
- old Reel duration limits;
- old carousel-count limits;
- old codec/file-size rules.

## Durable checks

Regardless of route:
- correct orientation;
- no unintended crop;
- readable critical text;
- valid rights;
- correct cover;
- synchronized audio;
- no corruption;
- metadata matches final content;
- current account authorization exists.

## Automation

If a publishing integration returns a validation error, treat it as:
- `blocked_technical`

and route to the publishing layer.

Do not modify editorial content merely to satisfy a technical error unless the route constraint genuinely requires it.
