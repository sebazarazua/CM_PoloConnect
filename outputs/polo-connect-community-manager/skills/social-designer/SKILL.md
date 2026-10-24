---
name: social-designer
description: "Turn an approved Polo Connect content opportunity into a professional social graphic design system and production specification for Instagram posts, carousels, results, fixtures, statistics, quote cards, announcements, and Stories. Use for visual concept, hierarchy, layout, slide sequencing, photo treatment, typography behavior, data visualization, brand consistency, accessibility, and render handoff. Do not use for benchmark research, news verification, final caption writing, Reel editing, or publishing."
---

# Social Designer

## Purpose

Convert an approved Polo Connect opportunity into an original, production-ready visual design specification.

The skill decides:
- the visual concept;
- information hierarchy;
- composition;
- image/footage frame usage;
- number and role of carousel slides;
- typography behavior;
- color behavior;
- score/stat treatment;
- photo treatment;
- brand presence;
- sponsor treatment;
- responsive crop/safe-area behavior;
- accessibility;
- variation within the Polo Connect identity;
- what the renderer/designer must produce.

It is responsible for visual authorship and system consistency, not for copying external social posts.

It does not:
- verify news from scratch;
- decide whether content deserves production;
- perform benchmark research;
- write the final Instagram caption;
- fabricate players, horses, venues, crowds, or documentary scenes;
- publish content;
- silently change approved facts or editorial angle.

## Core principles

1. Polo Connect must have a recognizable visual identity without forcing every post into the same template.
2. Real photography, real broadcast frames, real horses, real players, real venues, and real statistics are the preferred substrate.
3. Design should clarify the story before decorating it.
4. Hierarchy is more important than visual density.
5. A viewer should understand the primary message at feed-scroll speed.
6. Benchmark inspiration must be abstracted into mechanisms; never trace layouts or imitate recognizable brand systems.
7. Sports graphics should feel current without becoming generic "sports poster" design.
8. Premium does not mean empty, dark, gold, or serif by default.
9. Viral does not mean loud, neon, outlined, or overloaded by default.
10. Data visualization must remain truthful and legible.
11. Brand marks and sponsor marks are not the visual focal point unless the content objective explicitly requires it.
12. Templates are systems for speed and consistency, not prisons.
13. AI-generated visual material must not replace authentic polo reality.
14. Platform specifications are time-sensitive and should remain in refreshable references rather than embedded throughout core creative logic.

## Required references

Before substantial design planning, read:

- `references/design-system-and-identity.md`
- `references/layout-and-hierarchy.md`
- `references/carousel-architecture.md`
- `references/sports-data-visualization.md`
- `references/photo-treatment-and-authenticity.md`
- `references/templates-and-variation.md`
- `references/accessibility-and-readability.md`
- `references/render-handoff.md`

Read `references/platform-output-2026.md` when aspect ratio, carousel count, crop, feed/grid preview, API publishing, or export behavior matters.

Use `assets/social-design-plan.schema.json` for machine-readable plans.

## Expected upstream input

Prefer an approved `content-opportunity-detector` handoff containing:

- content objective;
- audience job;
- preferred format;
- editorial angle;
- verified facts;
- required assets;
- rights constraints;
- timing;
- benchmark mechanisms if relevant;
- success signal.

Use `editorial-strategist` guidance for:
- current brand behavior;
- active narratives;
- audience priority;
- visual fatigue;
- sponsor/product constraints.

If a factual premise is not verified, route back to `polo-news-researcher`.

If the opportunity itself is not approved, do not approve it inside this skill.

## Inputs

Accept one or more of:

- approved opportunity;
- brand assets;
- Polo Connect logo files;
- color/type tokens;
- photography;
- broadcast frames;
- statistics;
- score/result data;
- quotes;
- sponsor assets;
- tournament logos;
- benchmark mechanisms;
- previous Polo Connect designs;
- rendering tool capabilities.

## Workflow

### 1. Restate the visual job

Define one sentence:

> The viewer should immediately understand/feel [X], while the design uses [Y] as the dominant visual carrier.

Examples:
- "The viewer should understand who won within one second, while the match photograph carries the emotion."
- "The viewer should swipe to understand why this player leads the ranking, using one statistic per slide rather than a dense table."

If the visual job is unclear, the design is not ready.

### 2. Confirm content facts and asset rights

Before design:
- verify names;
- score;
- date/time;
- tournament;
- team/player/horse identity;
- quote wording;
- ranking/stat values;
- sponsor requirements;
- image/video rights.

Mark missing or provisional fields.

Do not design around a false certainty.

### 3. Identify the primary visual carrier

Choose the main carrier:

- authentic photo;
- broadcast still;
- score/result;
- statistic;
- quote;
- player/horse identity;
- fixture/time;
- venue;
- product UI;
- graphic diagram;
- mixed media.

Only one element should dominate the first read.

### 4. Choose content structure

Select:

- `single_image`
- `carousel`
- `story`
- `story_sequence`
- `graphic_frame_for_reel`
- `cover`
- `multi_surface_system`

Do not choose carousel merely to increase slide count.

A carousel should exist because sequence adds value.

### 5. Establish information hierarchy

Rank information:

1. must understand immediately;
2. useful secondary context;
3. supporting metadata;
4. optional detail;
5. caption-only information.

Do not force caption-level detail into the artwork.

For result graphics, for example:
- result/teams may be level 1;
- tournament/stage level 2;
- scorers/details level 3 or later slide;
- generic CTA level 4 or omitted.

### 6. Define composition

Specify:
- focal point;
- visual weight;
- subject scale;
- image crop;
- negative space;
- text zones;
- logo position;
- sponsor zone;
- score/stat zone;
- direction of visual flow.

Describe spatial logic rather than fixed pixel coordinates unless the renderer requires them.

### 7. Define visual concept

A concept should describe the idea behind the visual system.

Good:
- "Let the horse/rider fill the frame and keep the result compressed into a quiet lower information band."
- "Use the ranking movement itself as the visual story, with each slide revealing one jump."

Bad:
- "Make it modern."
- "Make it like ESPN."
- "Use gradients and glow."

### 8. Apply benchmark mechanisms selectively

If `benchmark-researcher` supplied mechanisms:
- use only what supports this piece;
- name the abstract mechanism;
- reinterpret through Polo Connect's visual identity;
- avoid recognizable compositions, typography systems, or branded graphic devices.

A benchmark may influence hierarchy, image treatment, information density, rhythm, or sequence without dictating the design.

### 9. Choose image treatment

Specify:
- full-bleed vs contained;
- crop strategy;
- color correction intent;
- contrast;
- background separation;
- texture/grain only when justified;
- masking/cutout only when it adds clarity;
- monochrome/duotone only when consistent with brand and content.

Do not overprocess authentic footage into synthetic-looking imagery.

### 10. Define typography behavior

Specify:
- display vs information role;
- hierarchy levels;
- case behavior;
- alignment;
- number treatment;
- score treatment;
- line-length intent;
- emphasis logic.

Use existing Polo Connect type tokens when available.

If no formal type system exists, mark the recommendation as provisional and route identity decisions to the brand system rather than inventing a permanent typeface inside one post.

### 11. Define color behavior

Use brand color as a system, not a requirement that every surface be saturated.

Specify:
- base;
- text;
- accent;
- status colors if needed;
- contrast behavior;
- team/tournament colors if appropriate;
- sponsor conflicts.

Do not let team colors destroy Polo Connect recognizability.

Do not encode score meaning using color alone.

### 12. Plan data graphics

For scores, rankings, stats, comparisons, schedules, and standings:
- establish the exact comparison;
- choose the simplest accurate visual representation;
- state units;
- preserve scale integrity;
- label values clearly;
- avoid pseudo-charts when a number is clearer;
- avoid decorative data density.

Read `references/sports-data-visualization.md`.

### 13. Plan carousel narrative

If carousel:
- define the function of each slide;
- make slide 1 earn the swipe;
- avoid repeating the same headline on every slide;
- create progression;
- preserve visual continuity without cloning layouts;
- end with consequence, utility, or meaningful CTA if applicable.

Do not use 10 slides when 4 communicate the story better.

### 14. Define template relationship

Classify the execution:

- `existing_template`
- `template_variant`
- `new_reusable_system`
- `bespoke_editorial`

Use existing templates only when they serve the content.

If a new recurring pattern emerges, design a reusable system rather than duplicating one-off files manually.

### 15. Define brand presence

Branding may include:
- Polo Connect mark;
- corner bug;
- frame/border;
- type behavior;
- color tokens;
- data package;
- recurring metadata treatment;
- cover system.

Brand recognition should come from the system, not from making the logo enormous.

### 16. Define sponsor treatment

Specify:
- sponsor asset;
- minimum/maximum prominence if contractually defined;
- co-brand hierarchy;
- exclusion zone;
- slide(s) where sponsor belongs;
- whether sponsor can be integrated editorially.

Do not invent sponsor obligations.

### 17. Run authenticity gate

Reject or redesign directions that depend on:
- AI-generated player;
- AI-generated horse;
- fake match setting;
- generated crowd;
- synthetic stadium/field;
- fake documentary photography;
- fabricated sponsor integration;
- overpainting that changes sporting reality.

Allowed technical operations may include:
- crop;
- exposure;
- color correction;
- cleanup of non-material distractions;
- background removal for a genuine subject;
- resolution enhancement that does not alter factual content.

### 18. Run readability gate

Test conceptually at:
- fast feed scroll;
- small mobile display;
- profile grid thumbnail;
- carousel swipe;
- Story overlay environment where applicable.

Ask:
- Is the primary message obvious?
- Can score/names be read without zooming?
- Is text competing with the subject?
- Does crop survive common previews?
- Is contrast sufficient?
- Does slide 1 work independently?

### 19. Run originality gate

Ask:
- Can the design be described without naming a benchmark brand?
- Would a reasonable viewer mistake it for another account?
- Are distinctive benchmark devices being copied?
- Does Polo Connect's own imagery/data/identity carry the execution?

If not, redesign.

### 20. Choose render path

Return one:

- `canva`
- `adobe`
- `figma`
- `html_canvas`
- `image_renderer`
- `manual_designer`
- `existing_template_engine`
- `other`

Selection depends on:
- available connected tools;
- template needs;
- speed;
- automation;
- brand controls;
- export requirements.

Do not claim the tool is connected if connection has not been confirmed.

### 21. Create render handoff

Provide:
- visual job;
- output format;
- dimensions/aspect intent;
- slide count;
- per-slide specification;
- asset map;
- crop notes;
- text;
- data;
- type roles;
- color roles;
- image treatment;
- logo/sponsor rules;
- safe-area guidance;
- template relationship;
- accessibility;
- export checks;
- source-of-truth facts.

The renderer should not need to reinterpret the editorial strategy.

## Decision states

Return one:

- `ready_for_render`
- `ready_with_asset_request`
- `blocked_assets`
- `blocked_verification`
- `blocked_rights`
- `brand_system_required`
- `replan_required`

`ready_for_render` requires all material facts and critical rights to be resolved.

## Hard gates

Never approve a design that:
- copies a benchmark layout substantially unchanged;
- fabricates documentary sports reality;
- modifies a player's/horse's identity deceptively;
- presents unverified data as fact;
- uses illegible score/stat treatment;
- has no clear first-read hierarchy;
- relies on hidden caption context to make a misleading visual accurate;
- assumes external media is reusable because it is public;
- forces a generic AI poster aesthetic;
- lets decorative effects obscure sports information;
- uses sponsor assets incorrectly or invents contract requirements.

## Quality bar

A successful design plan should let a strong designer or rendering tool produce a piece that:
- communicates instantly;
- feels native to modern sports media;
- remains recognizably Polo Connect;
- uses authentic material;
- preserves factual accuracy;
- varies intelligently from previous posts;
- can be produced without copying benchmark brands.

If the specification is mostly adjectives such as "premium", "dynamic", "modern", or "viral", it is incomplete.
