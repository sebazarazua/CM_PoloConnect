# Evidence and metrics

## Evidence levels

### E1 — Direct
Visible in the content or provided by an authorized first-party source.

Examples:
- publication timestamp;
- caption;
- video duration;
- visible likes/comments;
- Polo Connect first-party reach when authorized.

### E2 — Platform/API or trusted analytics source
Returned by an authorized platform integration or analytics provider.

Always attach:
- provider;
- observation time;
- metric definition when relevant.

### E3 — Derived
Calculated from E1/E2 data.

Examples:
- comments per 1,000 followers;
- performance multiple vs account median.

Store the formula.

### E4 — Interpretation
Professional inference from E1–E3 evidence.

Never present E4 as fact.

### E5 — Unknown
Unavailable, inaccessible, ambiguous, or unsupported.

Do not estimate merely to fill the field.

## Competitor metrics

External Instagram accounts do not expose the same data available to the owner.

Public/competitor analysis may include, depending on source availability:
- followers;
- post count;
- Reel count;
- likes;
- comments;
- public interactions;
- provider-calculated engagement.

Do not assume access to:
- reach;
- impressions;
- saves;
- shares;
- watch time;
- average watch duration;
- completion rate;
- retention curve;
- profile visits;
- follows generated;
- link clicks;
- audience demographics.

If a provider exposes another metric, record the provider and exact definition.

## Engagement comparability

Never compare rates with different denominators without saying so.

For example, a competitor analytics provider may calculate:
`average interactions / followers`

while an owned-account engagement metric may use:
`interactions / reach`

These answer different questions.

## Baselines

Preferred order:
1. median of comparable posts from the same account and format;
2. median from the same account across a close period;
3. peer-account normalized comparison;
4. raw performance only when no baseline exists.

Prefer median over mean for skewed social-performance distributions.

## Observation discipline

Every volatile metric must include `observed_at`.

Do not store changing social counts as timeless facts.

## Causality

Never write:
- "the Reel performed because it used..."
unless controlled evidence exists.

Prefer:
- "the post combines X with above-baseline comments; X is a plausible mechanism worth testing."

## Missing data

Missing data is not a defect if the limitation is real.

Use:
- `null`
- `unavailable`
- `not_public`
- `not_authorized`
- `not_captured`

Do not replace missing data with zero.
