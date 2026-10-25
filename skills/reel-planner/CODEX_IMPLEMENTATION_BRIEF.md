# Codex implementation brief

Use `$skill-creator` to create or install the `reel-planner` skill from this package.

Implementation requirements:
- preserve the boundary between approved opportunity, Reel planning, editing, captioning, and publishing;
- keep authentic owned/licensed footage as the default creative substrate;
- do not introduce image/video generation as a substitute for real match footage;
- preserve rights, fact, and asset gates;
- preserve source/timecode-based footage selection;
- do not force a logo intro or generic engagement hook;
- keep technical platform requirements refreshable in `platform-output-2026.md`;
- do not hardcode fragile Meta codec/duration limits inside the core narrative workflow;
- run current skill validation / `quick_validate.py`;
- run included Python tests;
- test trigger boundaries;
- do not add unrelated README/changelog files;
- generate any current Codex-required metadata through `$skill-creator`.

Positive trigger examples:
- "Tenemos aprobado un Reel con este gol. Armá el plan de edición."
- "De estos timecodes, elegí el mejor hook y estructurá el Reel."
- "Prepará un brief para el editor con este highlight."
- "Cómo debería estar armado el Reel de la final?"
- "Planificá el Reel con footage, overlays, audio y portada."

Negative trigger examples:
- "Esto merece un Reel o una Story?" -> content-opportunity-detector.
- "Verificá el resultado." -> polo-news-researcher.
- "Buscá ejemplos de ESPN y 433." -> benchmark-researcher.
- "Editá/exportá el video final." -> reel-editor/video-production skill.
- "Escribí el caption del Reel." -> copywriter.
- "Publicalo." -> publishing skill.

Acceptance criteria:
- every ready plan has a single clear Reel job;
- hook is explicitly defined and tied to real footage/data;
- at least one must-use clip exists;
- selected clips include source IDs and, when available, timecodes;
- beat sheet is time ordered and narratively purposeful;
- audio mode is explicit;
- rights state is explicit;
- cover derives from authentic content unless another approved asset is justified;
- artificial sports/documentary footage is rejected;
- editor freedom and must-preserve constraints are separated;
- final technical export requirements are verified downstream against current Instagram/Meta behavior.
