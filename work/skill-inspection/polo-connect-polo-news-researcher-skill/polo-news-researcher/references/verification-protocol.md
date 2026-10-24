# Verification protocol

## Claim statuses

### `confirmed_primary`
Directly established by the authoritative/primary source for that fact.

### `confirmed_multi_source`
Supported by at least two genuinely independent credible sources when no single authoritative primary source exists.

### `reported_single_source`
Credible original reporting exists, but independent confirmation is absent.

### `participant_claim`
Claim made directly by an involved participant but not independently established.

### `rumor`
Circulating claim lacking sufficient reliable evidence.

### `disputed`
Credible sources materially conflict.

### `false_or_corrected`
Credible evidence shows the claim is false, outdated, mistranslated, or formally corrected.

### `unknown`
Insufficient evidence.

## Confidence

Assign claim-level confidence:

- `high`
- `medium`
- `low`

Confidence must follow evidence; it is not a stylistic choice.

## High-risk claims

Require heightened caution for:
- injuries and health;
- death;
- disciplinary matters;
- legal allegations;
- contract/financial claims;
- accusations of misconduct;
- private personal information;
- claims that could materially damage reputation.

For these, prefer direct official/participant confirmation or strong independent reporting. Do not publish rumor as news.

## Quotes

For a quote:
- find the original interview/post when practical;
- preserve meaning;
- distinguish direct quote from paraphrase;
- retain context that materially changes interpretation;
- do not reconstruct a quote from multiple paraphrases.

## Scores and results

Verify:
- teams;
- final score;
- handicap/half-goal if displayed;
- tournament/stage;
- date;
- venue when relevant.

If a score differs between sources, do not average or choose silently.

## Schedules

Treat schedules as mutable.

Store:
- scheduled time;
- timezone/locality;
- source timestamp;
- status;
- postponement/reschedule evidence.

A previously correct fixture can become stale.

## Rankings

Record:
- ranking body;
- ranking type/category;
- observation date;
- points/value;
- methodology link or description when available.

Never merge rankings from different systems as if equivalent.

## Corrections

If a source updates or corrects a story:
- preserve correction metadata;
- prefer the corrected fact;
- mark earlier information superseded;
- propagate the correction to the event record.
