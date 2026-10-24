# Codex implementation brief

Use `$skill-creator` to create or install the `copywriter` skill from this package.

Implementation requirements:
- preserve the boundary between verification, strategy, design/video planning, copywriting, and publishing;
- use approved facts as source of truth;
- preserve variable tone by story type instead of one repetitive "brand voice";
- preserve Argentine Spanish rules when audience is Argentina;
- keep anti-AI language checks strong without making copy unnaturally robotic or terse;
- do not hardcode hashtag counts or caption-length folklore;
- preserve optional CTA/emoji/hashtag behavior;
- never infer social handles from names;
- benchmark copy may inform mechanisms but wording must remain original;
- keep current platform-specific constraints refreshable in `platform-adaptation.md`;
- run current skill validation / `quick_validate.py`;
- run included Python tests;
- test trigger boundaries;
- do not add unrelated README/changelog files;
- generate current Codex-required metadata through `$skill-creator`.

Positive trigger examples:
- "Escribí el caption final para esta placa aprobada."
- "Dame el titular y overlays para este resultado."
- "Prepará el copy slide por slide del carrusel."
- "Escribí las Stories de la previa."
- "Adaptá este contenido a un caption de Reel."
- "Necesito un CTA para llevar al replay sin sonar publicitario."

Negative trigger examples:
- "Esto merece publicarse?" -> content-opportunity-detector.
- "Verificá este resultado." -> polo-news-researcher.
- "Buscá referencias de captions de ESPN." -> benchmark-researcher.
- "Diseñá la placa." -> social-designer.
- "Planificá el Reel." -> reel-planner.
- "Publicalo." -> publishing skill.

Acceptance criteria:
- all factual claims map to verified source facts;
- copy adds value beyond repeating the visual;
- tone matches story importance;
- ready copy passes anti-AI, originality, factual, tone, and asset-consistency QA;
- no unresolved placeholders;
- no generic CTA requirement;
- emoji and hashtags remain optional/contextual;
- social mentions are verified handles, not inferred names;
- headline/overlay/caption are treated as different copy surfaces;
- final copy sounds natural when read aloud.
