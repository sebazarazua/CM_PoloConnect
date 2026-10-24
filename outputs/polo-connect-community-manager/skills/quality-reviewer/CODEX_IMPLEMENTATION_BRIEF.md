# Codex implementation brief

Use `$skill-creator` to create or install the `quality-reviewer` skill from this package.

Implementation requirements:
- preserve reviewer independence from creator skills;
- preserve three review stages: pre_render, post_render, pre_publish;
- preserve severity semantics and routing ownership;
- do not allow blockers/majors to be averaged away by scores;
- preserve explicit source-of-truth and cross-surface consistency checks;
- inspect actual rendered assets when available, not just briefs;
- preserve authenticity/anti-AI and originality gates;
- preserve rights/sponsor/accessibility/platform gates;
- exact Instagram/Meta/Metricool technical constraints must be refreshed for the actual publishing route rather than hardcoded;
- preserve human approval/version binding;
- support delta re-review after fixes;
- run current skill validation / `quick_validate.py`;
- run included Python tests;
- test trigger boundaries;
- do not add unrelated README/changelog files;
- generate current Codex-required metadata through `$skill-creator`.

Positive trigger examples:
- "Revisá esta pieza completa antes de publicarla."
- "Hacé QA del Reel, caption, portada y derechos."
- "Decime si esta placa está realmente lista para aprobación."
- "Revisá la versión corregida y cerrá los issues."
- "Chequeá que copy y visual tengan los mismos datos."
- "Hacé preflight para publicar por Metricool."

Negative trigger examples:
- "Verificá si esta noticia es cierta." -> polo-news-researcher.
- "Escribí el caption." -> copywriter.
- "Diseñá la placa." -> social-designer.
- "Planificá el Reel." -> reel-planner.
- "Qué deberíamos publicar?" -> content-opportunity-detector.
- "Analizá el rendimiento después de publicado." -> performance-analyst.

Acceptance criteria:
- full reviews identify review stage, mode, versions, and source of truth;
- material factual contradictions are blockers;
- required asset rights uncertainty blocks;
- copied/synthetic/deceptive sports content blocks appropriately;
- every issue has owner, fix, impact, and recheck scope;
- no open blocker or major can pass;
- partial review cannot pass for publish;
- pass_for_publish requires pre_publish, current platform preflight, rights pass, facts pass, and required approval;
- corrections can be rechecked as deltas without redoing unrelated QA;
- the reviewer never silently rewrites strategy to rescue a failing asset.
