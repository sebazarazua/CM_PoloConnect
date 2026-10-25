# Codex implementation brief

Use `$skill-creator` to create or install the `content-opportunity-detector` skill from this package.

Implementation requirements:
- preserve the boundary between verification, opportunity selection, production, and publishing;
- keep `SKILL.md` procedural and use the reference files rather than merging them into one prompt;
- preserve explicit reject/no-post decisions;
- preserve fatigue, duplication, rights, asset-readiness, and timing gates;
- do not hardcode a fixed Reel/carousel/Story ratio;
- do not make benchmark popularity override editorial value;
- run current skill validation / `quick_validate.py`;
- run the included Python tests;
- test both positive and negative trigger prompts;
- do not add unrelated README/changelog files;
- generate current Codex-required metadata through `$skill-creator` if needed.

Positive trigger examples:
- "Qué deberíamos publicar hoy con estas noticias y partidos?"
- "De estas 12 ideas, priorizá cuáles realmente merecen contenido."
- "Tenemos el gol final, fotos y el resultado. Qué hacemos y en qué formato?"
- "Armá la cola editorial para mañana."
- "Esto amerita un feed post, Story o nada?"
- "Detectá oportunidades de contenido alrededor de la final del domingo."

Negative trigger examples:
- "Verificá si este rumor es cierto." -> polo-news-researcher.
- "Analizá cómo ESPN hizo esta placa." -> benchmark-researcher.
- "Escribí el caption final." -> copywriter.
- "Diseñá la placa." -> social-designer.
- "Editá el Reel." -> reel production skill.
- "Publicalo a las 19." -> publishing/scheduling skill.

Acceptance criteria:
- every approved opportunity has a specific audience job and primary objective;
- no candidate is approved merely to maintain posting frequency;
- duplicate or saturated ideas are merged, downgraded, held, or rejected;
- timing/expiry is explicit for reactive opportunities;
- required assets and rights are explicit;
- format follows the content job;
- approved items include one preferred format, not a vague option list;
- the handoff is sufficient for the next skill without re-deciding strategy;
- rejected opportunities have a concrete reason;
- live/owned-access advantages are recognized without forcing every live moment into feed content.
