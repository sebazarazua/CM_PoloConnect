# Integraciones

Los puertos editoriales están en `src/providers/contracts.ts`. La integración manual real de Instagram tiene contratos propios para OAuth, contenedores, hosting y journal en `src/integrations/instagram/`; ver [INSTAGRAM_PUBLISHING.md](INSTAGRAM_PUBLISHING.md). Los comandos fixture conservan sus providers locales. El executor IA es una capacidad separada y opt-in.

| Puerto | Operaciones | Implementación actual | Adapter futuro |
|---|---|---|---|
| PublishingProvider / InstagramPublishingContract | mock anterior; OAuth, createContainer, status, publishContainer, reconcile en Instagram | MockPublishingProvider e InstagramPublishingProvider manual con journal persistente | Metricool |
| AnalyticsProvider | snapshot con ventana y definiciones | MockAnalyticsProvider | Instagram Insights / Metricool |
| DesignRenderer | render de plan con fuentes | MockDesignRenderer y LocalDesignRenderer con Chromium/PNG/JPG/QA | Canva / Adobe / Figma |
| VideoProvider | discoverClips, getMetadata, requestCut, getRender | MockVideoProvider | streaming y pipeline de cortes/renders |
| AssetRepository | findForEvent, get, save | ReferenceAssetRepository | S3 / Drive / filesystem / Polo Connect |
| PoloConnectDataProvider | partidos, calendario, torneos, resultados, estadísticas, players, teams, horses, streams, replays | Fixtures explícitos; entidades no disponibles devuelven lista vacía | Backend Polo Connect |
| PoloSourceProvider | discover de eventos con clave canónica | MockPoloSourceProvider | AAP / PoloLine / PoloHUB / WPT / USPA |
| SkillExecutor | execute(bundle, structuredInput) | FixtureSkillExecutor / CallbackSkillExecutor / GeminiSkillExecutor / OpenAIResponsesSkillExecutor | Otros modelos autorizados |

El ledger `getStatus()` del mock corresponde a la instancia actual. Tras reiniciar, la historia durable se consulta con `cm:inspect`, que usa las publicaciones persistidas. Un proveedor futuro debe implementar recibos/status durables, cancelación confirmada y reconciliación; no debe trasladar el ledger en memoria a producción.

## Cómo agregar un adapter

1. Implementar el puerto en una carpeta propia, separado de `mock/`.
2. Aportar tests de contrato con errores clasificados y valores faltantes explícitos.
3. Agregar configuración/secret resolver fuera del contexto editorial. No loguear credenciales.
4. Mapear IDs y timestamps del proveedor; para noticias resolver la clave de evento independientemente de la URL y mantener procedencia.
5. Respetar flags, gates de derechos y aprobación; no llamar APIs desde Skills o tests de fixtures.
6. Antes de habilitar publicación real, agregar outbox durable, reconciliación del proveedor, autenticación de aprobadores, reglas actuales de plataforma y pruebas en sandbox autorizado.

`ENABLE_REAL_PUBLISHING` acepta habilitación explícita para el CLI manual nuevo. Autoaprobación, rendering externo y fetching automático siguen bloqueados. El flag no cambia los providers de los comandos anteriores ni activa publicaciones por presencia de tokens.

## Assets y marca

`assets/{raw,approved,rendered,archive}` sólo contiene placeholders para referencias. Cada asset guarda derechos, fuente, crédito, referencia, metadata y, opcionalmente, vencimiento/plataformas permitidas. El gate excluye del payload assets seleccionados sin permiso reutilizable, incluso si fueron marcados opcionales. Los clips y audio del Reel tienen gates adicionales.

`brand/system.json` registra los originales aportados, el pack normalizado y la paleta. El renderer Chromium produce PNG/JPG reales con QA determinista y el QA visual real recibe los archivos finales. Los fixtures no certifican revisión IA. Ver [PRODUCTION_FINISH.md](PRODUCTION_FINISH.md).

## IA real independiente

`ENABLE_REAL_AI` habilita el executor seleccionado por `AI_PROVIDER`: Gemini predeterminado u OpenAI alternativo. No habilita publicación por sí solo. Endpoints oficiales, sin herramientas ni navegación, JSON estructurado, reservas/ledger y límites independientes por perfil. Ver [AI_RUNTIME.md](AI_RUNTIME.md) y [automatización con Gemini](AUTOMATION.md).
