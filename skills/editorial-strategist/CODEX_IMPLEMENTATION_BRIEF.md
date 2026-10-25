# Codex implementation brief

Use `$skill-creator` to create or install the `editorial-strategist` skill from this package.

Implementation requirements:
- preserve the distinction between account-level strategy and single-opportunity selection;
- keep `SKILL.md` procedural and retain detailed guidance in references;
- do not convert pillars into fixed percentage quotas;
- do not create a universal posting-frequency rule;
- preserve open/reactive capacity for sports coverage;
- preserve the principle that Polo Connect behaves as a media brand first and product promotion must add user value;
- preserve authentic real-world content as the preferred public substrate;
- keep measurement linked to explicit objectives;
- run current skill validation / `quick_validate.py`;
- run the included Python tests;
- test trigger boundaries against `content-opportunity-detector`, production skills, and performance analysis;
- do not add unrelated README/changelog files;
- generate current Codex-required metadata through `$skill-creator` if needed.

Positive trigger examples:
- "Armá la estrategia editorial de Instagram para noviembre."
- "Cómo debería cubrir Polo Connect todo el Abierto Argentino?"
- "Definí pilares y series para la cuenta."
- "Planificá la próxima semana dejando espacio para partidos y breaking."
- "Revisá la estrategia de la cuenta y decime qué deberíamos aumentar o reducir."
- "Organizá una campaña editorial para impulsar los partidos en vivo sin convertir la cuenta en publicidad."

Negative trigger examples:
- "Qué deberíamos publicar ahora con este resultado?" -> content-opportunity-detector.
- "Verificá esta noticia." -> polo-news-researcher.
- "Buscá referencias de ESPN y TyC." -> benchmark-researcher.
- "Diseñá este carrusel." -> social-designer.
- "Escribí el caption." -> copywriter.
- "Analizá las métricas de este Reel." -> performance-analyst.

Acceptance criteria:
- strategy contains explicit audience priorities and a small set of objectives;
- each objective has a primary KPI;
- pillars have an audience role and are not treated as mandatory quotas;
- recurring series have continuation/retirement logic;
- major tournaments are planned as narrative arcs;
- production capacity includes reactive reserve;
- empty days are allowed;
- product/sponsor integration is constrained by editorial value;
- experiments contain hypotheses and evaluation signals;
- the output includes an operational brief for `content-opportunity-detector`;
- performance review can change emphasis without reacting blindly to single-post noise.
