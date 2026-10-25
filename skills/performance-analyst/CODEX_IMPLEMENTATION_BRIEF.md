# Codex implementation brief

Use `$skill-creator` to create or install the `performance-analyst` skill from this package.

Implementation requirements:
- preserve objective-first measurement;
- preserve first-party Polo Connect priority over generic external benchmarks;
- preserve metric-definition and denominator metadata;
- never infer unavailable Instagram metrics;
- preserve paid vs organic separation;
- use comparable baselines and robust statistics rather than raw totals;
- preserve descriptive vs diagnostic vs causal distinctions;
- record confounders explicitly;
- preserve experiment analysis as a separate path from observational analysis;
- preserve learning maturity stages;
- do not promote one post to a strategic rule;
- include production-efficiency analysis when effort data exists;
- route learnings to the appropriate upstream skills;
- keep current Instagram/Metricool metric details refreshable in `platform-metrics-2026.md`;
- run current skill validation / `quick_validate.py`;
- run included Python tests;
- test trigger boundaries;
- do not add unrelated README/changelog files;
- generate current Codex-required metadata through `$skill-creator`.

Positive trigger examples:
- "Analizá cómo rindió este Reel comparado con nuestros Reels similares."
- "Qué aprendimos de la cobertura del Abierto?"
- "Decime si esta serie merece seguir."
- "Compará carousels vs Reels para contenido educativo, pero normalizá bien."
- "Evaluá el experimento de abrir con la jugada en vez del título."
- "Armá el informe mensual y actualizá nuestros aprendizajes internos."
- "Qué patrones propios ya tienen suficiente evidencia para pesar más que los benchmarks externos?"

Negative trigger examples:
- "Qué deberíamos publicar hoy?" -> content-opportunity-detector.
- "Armá la estrategia de noviembre." -> editorial-strategist.
- "Diseñá el carrusel." -> social-designer.
- "Planificá el Reel." -> reel-planner.
- "Escribí el caption." -> copywriter.
- "Revisá si la pieza está lista para publicar." -> quality-reviewer.
- "Buscá qué hace ESPN." -> benchmark-researcher.

Acceptance criteria:
- analysis begins from a question and objective, not from whichever metric is largest;
- all metrics retain source, observation window, availability, and denominator/definition where relevant;
- comparison sets are explicit;
- external benchmark rates are never treated as equivalent to owned metrics when formulas differ;
- paid and organic data are not silently mixed;
- one-post observations cannot become validated internal patterns;
- causal claims require appropriate evidence and acknowledge confounders;
- learnings have maturity, scope, confidence, and next test;
- recommendations identify owner and action;
- internal validated evidence progressively outranks external benchmark assumptions;
- output includes what should NOT be concluded.
