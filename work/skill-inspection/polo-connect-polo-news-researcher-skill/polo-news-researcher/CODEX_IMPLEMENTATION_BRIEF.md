# Codex implementation brief

Use `$skill-creator` to create or install the `polo-news-researcher` skill from this package.

Implementation requirements:
- preserve claim-level verification and event-level deduplication;
- keep time resolution explicit;
- preserve the distinction between discovery sources and confirmation sources;
- do not flatten the source strategy into a simplistic fixed hierarchy;
- keep final content generation and publishing outside this skill;
- run the current skill validator / `quick_validate.py`;
- run the included Python tests;
- test triggers with current-news, verification, schedule, result, ranking, and rumor cases;
- do not add unrelated README/changelog files;
- generate any current Codex-required metadata through `$skill-creator` rather than hand-writing stale schema.

Positive trigger examples:
- "Qué pasó hoy en el polo y qué merece publicación?"
- "Verificá el resultado de La Natividad y buscá fuentes."
- "Investigá si cambió el horario del partido de mañana."
- "Qué novedades hay del Abierto de Tortugas?"
- "Chequeá este rumor sobre un jugador antes de publicarlo."
- "Armá una cola de noticias verificadas para Polo Connect."

Negative trigger examples:
- "Escribime el caption del resultado." -> copywriting/content skill.
- "Diseñá una placa de resultado." -> design skill.
- "Analizá cómo TyC presenta resultados." -> benchmark-researcher.
- "Publicá esta noticia en Instagram." -> publishing skill.
- "Analizá las métricas de nuestros posts." -> performance skill.

Acceptance criteria:
- current claims include absolute dates and provenance;
- event date is not confused with article publication date;
- duplicate coverage becomes one canonical event;
- circular sourcing does not count as corroboration;
- rumor/disputed claims cannot silently become publishable facts;
- source conflicts are visible;
- rights state is recorded separately from factual publishability;
- output produces a clear publish/prepare/monitor/background/reject recommendation.
