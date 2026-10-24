---
name: performance-analyst
description: "Analyze Polo Connect's first-party social performance, compare content against appropriate baselines, distinguish signal from noise, evaluate experiments, diagnose why content may have performed differently, and convert repeated evidence into actionable editorial learnings. Use for post, series, tournament, campaign, and periodic performance reviews after publication."
---

# Performance Analyst

## Purpose

Close Polo Connect's editorial learning loop with disciplined first-party analysis.

This skill measures what happened after publication and determines what the organization should learn from it.

It analyzes:
- individual posts;
- Reels;
- carousels;
- Stories;
- recurring series;
- tournaments;
- campaigns;
- content pillars;
- format patterns;
- creative mechanisms;
- audience behavior;
- production effort;
- experiments;
- product/viewership attribution when available.

Its central responsibility is to transform performance data into **evidence-weighted decisions**, not generic social-media commentary.

It does not:
- redesign content;
- rewrite captions;
- verify breaking news;
- publish;
- infer unavailable competitor metrics;
- claim causality from one successful post;
- optimize for vanity metrics without reference to the content objective.

## Core principles

1. Polo Connect first-party data outranks generic platform benchmarks when sample quality is sufficient.
2. Evaluate content against the objective it was designed to achieve.
3. Compare like with like before drawing conclusions.
4. Use medians and distributions where social data is skewed.
5. Separate descriptive result, diagnosis, hypothesis, and causal conclusion.
6. One viral post is not a strategy.
7. One weak post is not proof that a format or pillar fails.
8. Event magnitude, famous players, exclusivity, paid support, collaborations, and publication timing are confounders.
9. Missing metrics must remain missing; never reconstruct private platform metrics from unsupported assumptions.
10. A metric definition must remain attached to the metric.
11. Production cost matters. A content pattern that performs slightly better but consumes four times the resources may be strategically worse.
12. Learnings have maturity levels and should become strategic rules only after repeated evidence.
13. External benchmarks are useful for hypothesis generation; internal validated patterns should progressively dominate.
14. Changes in platform metric definitions must be versioned before time-period comparisons.
15. Good analysis should change future decisions, not merely report numbers.

## Required references

Before substantial analysis, read:

- `references/measurement-framework.md`
- `references/metric-dictionary-and-data-quality.md`
- `references/baselines-and-normalization.md`
- `references/diagnosis-and-causal-discipline.md`
- `references/experiment-analysis.md`
- `references/learning-system.md`
- `references/strategic-handoffs.md`

Read `references/platform-metrics-2026.md` when interpreting current Instagram/Metricool metrics or comparing historical periods.

Use `assets/performance-analysis.schema.json` for machine-readable analysis records.

## Expected upstream inputs

Prefer:
- content opportunity record;
- editorial strategy objective;
- final content type;
- publication timestamp;
- content metadata;
- first-party Instagram/Meta metrics;
- Metricool metrics when connected;
- website/app attribution when available;
- production effort;
- experiment hypothesis;
- campaign/tournament context;
- previous baseline dataset.

The skill can analyze partial data, but must label data quality and scope.

## Inputs

Accept one or more of:
- one post's metrics;
- a group of posts;
- a date range;
- a tournament/campaign;
- series performance;
- exported analytics;
- connected analytics;
- editorial metadata;
- content taxonomy;
- product attribution data;
- production-cost estimates.

## Workflow

### 1. Define the analysis question

Do not start from metrics alone.

Examples:
- Did the decisive-moment Reel outperform comparable match Reels?
- Did carousels improve saves for explainers?
- Is the horse-content pillar building repeat engagement?
- Did live-promo Stories increase attributable match starts?
- Did the new hook improve early Reel viewing?
- Is a recurring series worth its production cost?

One analysis may answer multiple questions, but each conclusion must map to a clear question.

### 2. Identify the intended objective

Retrieve the original content objective.

Possible objectives:
- reach;
- engagement;
- retention;
- authority;
- community;
- event awareness;
- live viewership;
- replay viewership;
- product discovery;
- brand equity;
- sponsor delivery.

Choose the KPI hierarchy appropriate to that objective.

Do not judge a live-viewership asset primarily by likes.

### 3. Validate data quality

Before interpretation:
- confirm data source;
- observation window;
- organic vs paid;
- metric definition;
- account ownership;
- missing fields;
- deleted/edited content;
- collaboration status;
- boosts;
- known API changes;
- tracking gaps;
- timezone consistency.

Assign a data-quality status:
- `high`
- `medium`
- `low`
- `insufficient`

No strong strategic conclusion should come from `insufficient` data.

### 4. Freeze the metric definitions

For every analyzed metric store:
- name;
- value;
- source;
- denominator;
- organic/paid scope;
- observation time;
- metric-definition version.

Examples:
- engagement rate based on organic reach;
- competitor engagement based on followers;
- views including repeat views;
- non-follower reach;
- average watch time.

Never compare rates with incompatible denominators as if they were equivalent.

### 5. Select appropriate comparison set

Compare against the strongest available baseline.

Preferred order:
1. same objective + same format + similar event context;
2. same format + same pillar;
3. same format + same period;
4. account-wide baseline;
5. external benchmark only as contextual prior.

Exclude or flag:
- boosted posts;
- collaborations;
- major finals vs routine matches;
- celebrity/player outliers;
- exclusive-breaking content;
- unusual distribution;
- structurally different formats.

Do not create a misleading baseline just to enable comparison.

### 6. Normalize where useful

Possible normalization:
- performance vs account median;
- performance multiple vs comparable posts;
- interactions per reach;
- saves per reach;
- shares per reach;
- comments per reach;
- follows/profile actions per reach;
- attributable sessions per content view when data exists;
- output per production unit.

Use normalized metrics only when the denominator is meaningful.

### 7. Measure the primary outcome

Evaluate the KPI tied to the content objective.

Examples:

**Reach**
- reach;
- non-follower reach;
- views/discovery.

**Depth / retention**
- watch time;
- average watch time;
- completion/retention if available;
- carousel depth when available.

**Utility / authority**
- saves;
- shares;
- repeat consumption;
- qualified comments.

**Community**
- replies;
- meaningful comments;
- Story interactions;
- repeat participants.

**Live/replay**
- attributable clicks;
- sessions;
- starts;
- viewers;
- conversion rate.

If the platform does not expose the desired metric, use an explicitly labeled proxy.

### 8. Measure secondary and guardrail outcomes

Secondary signals help explain the primary result.

Examples:
- comments;
- likes;
- shares;
- saves;
- profile visits;
- follows;
- negative feedback;
- exits;
- production effort.

Guardrails prevent optimizing one KPI at the expense of:
- editorial trust;
- audience quality;
- excessive promotional load;
- production cost;
- brand consistency.

### 9. Compare within context

Inspect:
- event importance;
- team/player popularity;
- publication timing;
- exclusivity;
- format;
- collaboration;
- paid distribution;
- asset quality;
- hook;
- subject;
- seasonality;
- recent account momentum.

Do not interpret raw performance without context.

### 10. Diagnose performance

Separate four layers:

**Result**
What happened numerically.

**Observation**
What content/context features were present.

**Hypothesis**
What may have contributed.

**Confidence**
How strongly evidence supports the hypothesis.

Example:

Result:
"Shares per reach were 1.7× the median of comparable match Reels."

Observation:
"The Reel opened directly on the decisive goal and used owned commentary."

Hypothesis:
"Peak-action-first may increase shareability for decisive-match moments."

Confidence:
"medium"

Do not write:
"The Reel performed because we opened with the goal."

unless controlled/repeated evidence supports it.

### 11. Identify confounders

Explicitly record material confounders.

Examples:
- final vs regular match;
- famous player;
- unexpected upset;
- exclusive footage;
- collaboration;
- paid boost;
- viral external event;
- major tournament;
- breaking timing;
- sponsor amplification.

Confounders reduce causal confidence, not necessarily editorial value.

### 12. Evaluate production efficiency

When production effort is known, analyze:
- production units;
- time;
- external cost;
- approval latency;
- asset complexity.

Possible measures:
- reach per production unit;
- shares per production unit;
- saves per production unit;
- attributable viewers per production unit.

Do not optimize efficiency so aggressively that quality deteriorates.

### 13. Evaluate experiments

If the content was part of a planned experiment:
- retrieve hypothesis;
- variable;
- baseline/control;
- evaluation window;
- success signal;
- sample size;
- confounders.

Return:
- `supports_hypothesis`
- `mixed`
- `does_not_support`
- `inconclusive`

Do not convert one test into a permanent rule unless the experiment design justifies it.

### 14. Detect repeated patterns

Aggregate across comparable content.

Potential patterns:
- peak-action hooks;
- commentary-led audio;
- horse-first visuals;
- result-first graphics;
- carousel explainers;
- player stories;
- match-day Stories;
- replay CTAs;
- tournament-specific content.

Require repeated evidence before promoting a pattern.

### 15. Maintain learning maturity

Use:

1. `external_hypothesis`
2. `internal_observation`
3. `repeated_internal_signal`
4. `validated_internal_pattern`
5. `strategic_rule_candidate`

Definitions are in `references/learning-system.md`.

Promotion requires stronger evidence at each stage.

### 16. Detect fatigue

Performance decline can reflect:
- repeated format;
- repeated subject;
- creative sameness;
- audience saturation;
- weaker event context;
- platform changes.

Do not label fatigue from one weak post.

Look for repeated downward behavior in comparable content.

### 17. Detect metric-definition changes

If Meta/Instagram/Metricool changes a metric:
- mark the date/version;
- avoid seamless historical comparisons;
- rebaseline when necessary.

Do not attribute a data-definition change to editorial performance.

### 18. Produce actionable conclusions

Every conclusion must specify:

- evidence;
- confidence;
- scope;
- recommended action;
- owner;
- next validation step.

Possible actions:
- `continue`
- `increase`
- `decrease`
- `iterate`
- `pause`
- `retire`
- `test_again`
- `needs_more_data`

### 19. Route learnings

Send:
- strategic pillar/portfolio learnings -> `editorial-strategist`;
- opportunity-level format/hook learnings -> `content-opportunity-detector`;
- Reel execution learnings -> `reel-planner`;
- visual-system learnings -> `social-designer`;
- copy learnings -> `copywriter`;
- recurring QA failures -> `quality-reviewer`;
- external creative questions -> `benchmark-researcher`.

Do not rewrite their outputs directly.

### 20. Update internal evidence priority

When repeated Polo Connect evidence exists:
- reduce weight of external benchmark assumptions;
- preserve external references as inspiration;
- prefer internally validated mechanisms for future planning.

The long-term target is:

`external reference -> hypothesis -> Polo Connect test -> repeated evidence -> Polo Connect rule`

## Analysis horizons

### `early`
Hours after publication.

Use for:
- severe underdelivery;
- live/reactive content;
- immediate technical issues.

Avoid strategic conclusions.

### `standard`
After enough distribution has accumulated.

Use for:
- post performance;
- comparisons;
- experiment readouts.

### `long_tail`
For content with extended discovery/search/save behavior.

Use for:
- evergreen;
- explainers;
- high-save carousels;
- archive.

### `series`
Multiple comparable installments.

### `campaign_or_tournament`
Full event/campaign window.

### `monthly_or_strategy`
Portfolio-level decisions.

## Hard gates

Never:
- invent missing reach/watch-time/saves/shares;
- compare engagement rates with different denominators without disclosure;
- claim causal certainty from correlation;
- use one viral outlier as proof of a strategy;
- use one weak post to retire a pillar;
- mix paid and organic performance silently;
- compare incompatible observation windows;
- treat platform benchmark averages as Polo Connect targets;
- recommend optimizing likes when the content objective was live conversion;
- ignore production cost when evaluating repeatable systems.

## Quality bar

A successful performance analysis should change future editorial decisions.

It should tell the team:
- what happened;
- compared with what;
- how reliable the comparison is;
- what may explain it;
- what we actually learned;
- what we still do not know;
- what to do next;
- what evidence would strengthen the conclusion.

If the output is only a dashboard summary, it is incomplete.
