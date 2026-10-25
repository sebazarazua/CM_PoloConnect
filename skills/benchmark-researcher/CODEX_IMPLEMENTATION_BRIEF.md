# Codex implementation brief

Use `$skill-creator` to create or install the `benchmark-researcher` skill from this package.

Requirements:
- preserve the behavioral scope and anti-copy/evidence gates;
- keep `SKILL.md` procedural; do not merge all references into it;
- run the skill creator validator / `quick_validate.py`;
- run the included Python tests;
- inspect trigger behavior with positive and negative test prompts;
- do not create unrelated README/changelog files;
- do not alter the approved benchmark pool without explicit approval;
- if `$skill-creator` generates required metadata files for the current Codex version, generate them from the final skill rather than inventing stale schema by hand.

Positive trigger examples:
- "Analizá las mejores placas recientes de nuestras cuentas benchmark para un resultado de partido."
- "Buscá referencias para un Reel de highlight y decime qué mecanismos podemos adaptar."
- "Compará cómo distintas cuentas presentan estadísticas deportivas."
- "Necesito benchmark creativo antes de diseñar el anuncio del Abierto."

Negative trigger examples:
- "Escribime el caption final para este post." -> copywriting/content skill.
- "Publicá este Reel mañana." -> publishing/scheduling skill.
- "Analizá el rendimiento de nuestras últimas 20 publicaciones." -> Polo Connect performance skill.
- "Diseñá la placa final." -> design/production skill.

Acceptance:
- triggers on benchmark research and reference mining;
- does not trigger as the main skill for final content production or publishing;
- never fabricates unavailable external metrics;
- every recommendation separates evidence from interpretation;
- every creative transfer passes the originality gate;
- output is actionable without requiring imitation of the source.
