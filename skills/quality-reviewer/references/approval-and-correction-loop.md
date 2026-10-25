# Approval and correction loop

## Approval states

### `not_required`
Workflow explicitly permits automated low-risk publishing.

### `required_pending`
Human approval required and not yet granted.

### `approved`
Human approval recorded for the current content version.

### `reapproval_required`
A material change occurred after approval.

## Material changes

Require reapproval when applicable:
- headline changes meaning;
- score/stat changes;
- quote changes;
- key visual changes;
- sponsor placement changes materially;
- music changes;
- CTA destination changes;
- content timing/context changes;
- sensitive claim added.

Tiny typo/spacing fixes may not require reapproval if workflow policy permits.

## Version binding

Approval must bind to:
- asset version;
- copy version;
- metadata version.

Do not reuse approval for a materially different version.

## Correction workflow

1. issue opened;
2. owner fixes;
3. new version produced;
4. reviewer performs delta recheck;
5. dependent surfaces rechecked;
6. approval restored or requested again;
7. issue closed.

## Pre-publish final state

To return `pass_for_publish`:
- no blocker;
- no major;
- required corrections applied;
- platform preflight passed;
- rights passed;
- content not expired;
- required human approval = approved;
- final versions match reviewed versions.
