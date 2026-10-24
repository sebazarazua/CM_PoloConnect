# Codex implementation brief

Use `$skill-creator` to create or install the `social-designer` skill from this package.

Implementation requirements:
- preserve the boundary between approved opportunity, visual design specification, rendering, captioning, and publishing;
- keep authentic owned/licensed polo media as the preferred visual substrate;
- preserve anti-copy rules from benchmark mechanisms;
- do not convert the benchmark pool into templates;
- keep design-system rules separate from one-off execution;
- preserve data accuracy, rights, accessibility, and originality gates;
- do not hardcode fragile Instagram image/carousel limits into core design logic;
- keep current platform/output behavior refreshable in `platform-output-2026.md`;
- preserve a render handoff that can target Canva, Adobe, Figma, HTML/canvas, a template engine, or a human designer;
- run current skill validation / `quick_validate.py`;
- run included Python tests;
- test trigger boundaries;
- do not add unrelated README/changelog files;
- generate current Codex-required metadata through `$skill-creator`.

Positive trigger examples:
- "Diseñá la estructura visual de la placa de resultado."
- "Armá el carrusel de estadísticas slide por slide."
- "Prepará el brief de diseño para Canva."
- "Cómo debería verse esta placa de fixture?"
- "Tomá esta oportunidad aprobada y convertíla en un sistema visual."
- "Necesito una quote card que siga sintiéndose Polo Connect."

Negative trigger examples:
- "Esto merece una placa o Reel?" -> content-opportunity-detector.
- "Buscá referencias en TyC y ESPN." -> benchmark-researcher.
- "Verificá el resultado." -> polo-news-researcher.
- "Escribí el caption." -> copywriter.
- "Editá este video." -> reel/editor skill.
- "Publicalo." -> publishing skill.

Acceptance criteria:
- every ready design has one explicit visual job and primary carrier;
- hierarchy is explicit;
- authentic asset rights are explicit;
- slide count equals the defined sequence;
- carousel slides each have a function and progress the story;
- score/stat displays preserve source-of-truth values;
- benchmark mechanisms are abstracted rather than copied;
- brand presence is clear but not automatically dominant;
- accessibility is checked;
- render path is explicit;
- renderer freedom and must-preserve fields are separate;
- synthetic documentary sports reality is rejected.
