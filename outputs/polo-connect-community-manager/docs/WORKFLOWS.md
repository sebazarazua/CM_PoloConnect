# Workflows y operación

## Pipeline

```text
editorial-strategist -> polo-news-researcher + benchmark-researcher
 -> content-opportunity-detector
 -> social-designer OR reel-planner
 -> mock render/cut -> copywriter -> quality-reviewer (post_render)
 -> pending_approval -> aprobación explícita con actor y hash
 -> quality-reviewer (pre_publish) -> MockPublishingProvider
 -> MockAnalyticsProvider -> performance-analyst -> Learning
 -> próxima revisión de estrategia y contexto de las demás Skills
```

Los contratos de las Skills son validados con JSON Schema y con su validador Python antes de usarse. `runDailyDiscovery()` ejecuta estrategia inicial, benchmark e investigación de noticias; `runOpportunityPipeline(eventId, format, assets?)` resuelve una oportunidad; `runContentProduction(contentOrOpportunityId)` selecciona la rama gráfica/video; `runQualityReview(contentId)` prepara aprobación. `runWeeklyStrategyReview()` también recibe calendario, análisis, benchmarks y learnings.

## Estados

`detected -> researching -> verified -> opportunity_created -> approved_for_production -> planning -> in_production -> ready_for_qa -> ready_for_human_approval -> human_approved -> ready_to_publish -> published -> measuring -> analyzed -> archived`.

Estados alternativos: `awaiting_assets`, `blocked`, `qa_failed`, `human_rejected`. La tabla explícita de transiciones vive en `src/domain/state-machine.ts`. Las transiciones ilegales fallan y quedan auditadas. `archived` es terminal. Los servicios no permiten saltar de producción a publicación.

Las aprobaciones tienen estado independiente `pending_approval | approved | rejected | changes_requested`. Una aprobación invalidada conserva decisión histórica y agrega `invalidatedAt` y motivo. No cuenta como aprobación vigente aunque diga `approved` en su historial.

## Gates y responsables

| Condición | Resultado | Owner |
|---|---|---|
| Rumor, disputa o claim sin fuente | `blocked_verification` | polo-news-researcher |
| Fuente corregida | invalida dependientes y retorna a oportunidad | polo-news-researcher |
| Asset ausente | `awaiting_assets`/`blocked` | asset-rights-owner |
| Derechos desconocidos, reference-only, platform-only, restringidos o vencidos | `blocked_rights` | asset-rights-owner |
| QA con inconsistencia de copy | `qa_failed` | owner especificado en issue, por ejemplo copywriter |
| Dirección editorial equivocada | replanificación | content-opportunity-detector |
| Brand system requerido | bloqueo | brand-owner |
| Presupuesto de reroutes agotado | `blocked` | human-editor |

No se ejecuta automáticamente una corrección editorial potencialmente ambigua. El blocker guarda responsable y tarea; el operador o un futuro worker aporta el input corregido y llama al workflow correspondiente. Reintentos sólo para `retryable_error`, hasta `MAX_SKILL_RETRIES`. Reroutes hasta `MAX_REROUTES`; no hay ciclos automáticos indefinidos.

Para un asset o metadata corregidos: `reviseContent()`, `runContentProduction()`, `runQualityReview()`, nueva aprobación. Para cambio sólo de copy: `reviseContent()` deja `ready_for_qa`. Para cambio de score: `correctEvent()`, `runOpportunityPipeline()`, producción, QA y nueva aprobación. Los issues se conservan dentro de las revisiones históricas y el siguiente QA completo vuelve a evaluar la pieza.

## Publicación y performance

`simulatePublish()` requiere aprobación del hash actual, rights actuales y preflight completo. Puede recibir fecha futura para simular scheduling. El estado permanece `ready_to_publish` mientras la publicación mock está `scheduled`; no existe scheduler en background en esta fase. El mock no ejecuta ninguna publicación automáticamente al vencer la fecha. Cancelar o cambiar materialmente el contenido marca el registro programado como cancelado; no se envía a ningún proveedor real.

`runPerformanceAnalysis()` exige publicación mock, conserva snapshot/definiciones/ventana y produce learning con evidencia y siguiente test. Los datos simulados no promueven reglas estratégicas reales. En contexto futuro, la estrategia recibe análisis y learnings como inputs; ninguna Skill reescribe directamente el trabajo de otra.

## Aprobación local

`approveContent(contentId, actor, expectedPackageHash, comment?)` rechaza hashes viejos. La CLI imprime el hash al inspeccionar. El actor se declara por el operador; la autenticación y autorización del equipo deben implementarse antes de exponer el servicio mediante una API pública. No hay servidor HTTP abierto en esta entrega.
