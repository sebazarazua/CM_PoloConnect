# Integraciones

Todos los puertos están en `src/providers/contracts.ts`. Los adapters de contenido/publicación incluidos sólo usan memoria, fixtures y referencias locales. El executor IA es una capacidad separada, opt-in. No hay SDK de Meta, request HTTP de publicación, scraping ni conexión a cuentas sociales.

| Puerto | Operaciones | Implementación actual | Adapter futuro |
|---|---|---|---|
| PublishingProvider | validate, schedule, publish, getStatus, deleteScheduled | MockPublishingProvider con ledger de instancia y payload persistido por el servicio | Meta / Metricool |
| AnalyticsProvider | snapshot con ventana y definiciones | MockAnalyticsProvider | Instagram Insights / Metricool |
| DesignRenderer | render de plan con fuentes | MockDesignRenderer, referencia sin media | Canva / Adobe / Figma / HTML canvas |
| VideoProvider | discoverClips, getMetadata, requestCut, getRender | MockVideoProvider | streaming y pipeline de cortes/renders |
| AssetRepository | findForEvent, get, save | ReferenceAssetRepository | S3 / Drive / filesystem / Polo Connect |
| PoloConnectDataProvider | partidos, calendario, torneos, resultados, estadísticas, players, teams, horses, streams, replays | Fixtures explícitos; entidades no disponibles devuelven lista vacía | Backend Polo Connect |
| PoloSourceProvider | discover de eventos con clave canónica | MockPoloSourceProvider | AAP / PoloLine / PoloHUB / WPT / USPA |
| SkillExecutor | execute(bundle, structuredInput) | FixtureSkillExecutor / CallbackSkillExecutor / OpenAIResponsesSkillExecutor | Otros modelos autorizados |

El ledger `getStatus()` del mock corresponde a la instancia actual. Tras reiniciar, la historia durable se consulta con `cm:inspect`, que usa las publicaciones persistidas. Un proveedor futuro debe implementar recibos/status durables, cancelación confirmada y reconciliación; no debe trasladar el ledger en memoria a producción.

## Cómo agregar un adapter

1. Implementar el puerto en una carpeta propia, separado de `mock/`.
2. Aportar tests de contrato con errores clasificados y valores faltantes explícitos.
3. Agregar configuración/secret resolver fuera del contexto editorial. No loguear credenciales.
4. Mapear IDs y timestamps del proveedor; para noticias resolver la clave de evento independientemente de la URL y mantener procedencia.
5. Respetar flags, gates de derechos y aprobación; no llamar APIs desde Skills o tests de fixtures.
6. Antes de habilitar publicación real, agregar outbox durable, reconciliación del proveedor, autenticación de aprobadores, reglas actuales de plataforma y pruebas en sandbox autorizado.

En esta fase cualquier intento de activar `ENABLE_REAL_PUBLISHING`, `ENABLE_AUTO_APPROVAL`, `ENABLE_AUTO_RENDER` o `ENABLE_EXTERNAL_FETCHING` falla al cargar configuración. No basta con cambiar una flag para producir efectos externos: los transportes reales no existen.

## Assets y marca

`assets/{raw,approved,rendered,archive}` sólo contiene placeholders para referencias. Cada asset guarda derechos, fuente, crédito, referencia, metadata y, opcionalmente, vencimiento/plataformas permitidas. El gate excluye del payload assets seleccionados sin permiso reutilizable, incluso si fueron marcados opcionales. Los clips y audio del Reel tienen gates adicionales.

`brand/system.json` mantiene logos/colores/tipografía/spacing sin definir y lista lo faltante. No se aprobaron colores o fuentes inventados. Los planes demo declaran que su apariencia y checks son ficticios; no certifican diseño ni accesibilidad de media real. Los futuros renderers deben devolver archivos reales y el QA debe revisarlos antes de solicitar aprobación.

## IA real independiente

`ENABLE_REAL_AI` sólo habilita el executor OpenAI Responses en `cm:ai-demo`. No habilita ninguna integración de contenido/publicación. Endpoint oficial, sin herramientas ni navegación, structured outputs, reservas/ledger y límites en `config/ai.json`. Ver [AI_RUNTIME.md](AI_RUNTIME.md).
