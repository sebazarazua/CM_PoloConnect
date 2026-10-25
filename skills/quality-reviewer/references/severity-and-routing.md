# Severity and routing

## Severity

### `blocker`
Cannot publish.

Examples:
- wrong result;
- central unverified fact;
- required asset rights unknown/restricted;
- materially deceptive generated sports reality;
- legal/sponsor breach;
- publish route rejects file;
- wrong live/schedule information;
- direct plagiarism / copied creative expression.

### `major`
Substantially harms comprehension, brand, editorial quality, or accessibility.

Examples:
- headline contradicts angle;
- score is technically correct but unreadable;
- Reel buries decisive moment behind long intro;
- sponsor overwhelms editorial hierarchy contrary to brief;
- subtitles materially change quote meaning;
- severe synthetic-looking retouching;
- CTA points to wrong destination even if content is otherwise correct.

Major must be fixed before pass.

### `minor`
Noticeable defect that does not materially compromise truth, rights, strategy, or usability.

Examples:
- awkward line break;
- small spacing inconsistency;
- non-critical metadata alignment;
- optional hashtag issue.

May be accepted only when explicitly non-material.

### `note`
Observation or future improvement.

Does not block current content.

## Routing owners

### `polo-news-researcher`
- verification;
- factual conflict;
- date/result/source issue.

### `content-opportunity-detector`
- wrong format/job;
- expired opportunity;
- strategic mismatch at content level.

### `editorial-strategist`
- portfolio/campaign/account-level strategy.

### `reel-planner`
- hook/narrative/beat/audio-plan issue.

### `social-designer`
- visual hierarchy/design-system/data-viz issue.

### `copywriter`
- caption/headline/overlay/CTA/voice issue.

### `renderer_editor`
- execution drift, crop, export, mix, subtitle placement.

### `rights_owner`
- permissions/licensing/credits.

### `publishing_layer`
- API/scheduler/account technical readiness.

### `human_approver`
- explicit approval required by workflow.

## Issue format

Each issue should include:

- `issue_id`
- `severity`
- `category`
- `surface`
- `evidence`
- `problem`
- `impact`
- `owner`
- `required_fix`
- `recheck_scope`
- `status`

Do not use severity as an emotional label; tie it to publish risk.
