# Metric dictionary and data quality

## Metric record

Every metric should store:

- `name`
- `value`
- `source`
- `observed_at`
- `window`
- `organic_paid_scope`
- `denominator`
- `definition_version`
- `availability_status`

## Common Instagram first-party metrics

Availability can vary by content type, account, API, date, and tool.

Potential metrics include:
- reach;
- views;
- impressions when available;
- likes;
- comments;
- shares;
- saves;
- interactions;
- follows/profile activity;
- watch time;
- average watch time;
- Story exits;
- Story forward taps;
- Story back taps;
- link actions;
- audience breakdowns.

Never assume every metric exists for every content type.

## Metricool

Metricool currently exposes organic Instagram analytics and distinguishes owned-account metrics from competitor metrics.

Owned engagement can be calculated using organic interactions relative to organic reach.

Competitor engagement may use a different denominator because competitor reach is not available.

Never merge those rates.

## Competitor data

External public data may include:
- followers;
- public posts/Reels;
- likes;
- comments;
- public interactions;
- provider-calculated engagement.

Do not infer:
- reach;
- saves;
- shares;
- watch time;
- retention;
- profile actions.

## Missing data states

Use:
- `available`
- `not_available`
- `not_authorized`
- `not_applicable`
- `not_captured`
- `definition_changed`

Do not replace missing with zero.

## Data quality

### `high`
- first-party/authorized;
- definitions known;
- observation window aligned;
- no material tracking issue.

### `medium`
- some limitations;
- minor missing fields;
- usable comparison.

### `low`
- incomplete tracking;
- mismatched windows;
- unclear denominator;
- material confounders.

### `insufficient`
- cannot support requested conclusion.

## Paid vs organic

Store separately.

If content was boosted:
- analyze organic;
- analyze paid;
- analyze combined only when purpose requires it.

Do not compare boosted and unboosted posts without adjustment/disclosure.
