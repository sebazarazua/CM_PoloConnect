# Automatización v1 con Gemini

`npm.cmd run cm:auto-cycle` ejecuta una tarea corta: fuente → deduplicación → evento verificado → oportunidad → Gemini (diseño/copy) → PNG real → QA visual Gemini → política → Instagram → recibo persistente. Cierra Chromium, el cliente S3 y el repositorio; no instala un scheduler dentro del proceso. Railway Cron invoca el comando.

Los nueve contratos y Skills originales se conservan. El publisher existente conserva OAuth, S3, checkpoints, idempotencia y reconciliación. La nueva autorización por política se almacena aparte de las aprobaciones humanas y se revalida inmediatamente antes de `media_publish`.

## Configurar Gemini

El `.env` local se creó desde `.env.example` cuando todavía no existía. Está ignorado por Git. No volver a copiar el ejemplo sobre un `.env` que ya tenga claves.

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=COMPLETAR_LOCALMENTE
ENABLE_REAL_AI=true
GEMINI_MODEL_FAST=gemini-3.8-flash
GEMINI_MODEL_STANDARD=gemini-3.8-flash
GEMINI_MODEL_PREMIUM=gemini-3.8-flash
GEMINI_PRICING_FILE=config/pricing.gemini.json
AUTOMATION_MODE=supervised
AUTOMATION_DRY_RUN=true
ENABLE_AUTO_PUBLISH=false
ENABLE_REAL_PUBLISHING=false
```

La clave es de **Gemini Developer API**, no una credencial de Vertex AI. No se necesita `OPENAI_API_KEY`. El SDK oficial `@google/genai` envía JSON estructurado; el resultado vuelve a pasar por el schema original, Ajv y los validadores Python. QA adjunta los píxeles finales y comprueba su hash. Thinking LOW, límites por llamada y ningún tool de investigación o publicación. Los errores no conservan cuerpos de proveedor ni claves.

```powershell
npm.cmd run cm:gemini:check
npm.cmd run cm:auto-status
```

`cm:gemini:check` verifica configuración local sin llamar a Gemini ni comprobar la validez remota de la key. Agregarla no habilita IA ni publicación por sí solo. La alternativa OpenAI sigue disponible con `AI_PROVIDER=openai`, sus modelos `MODEL_*` y su tabla de precios independiente.

El perfil Gemini está en `config/ai.gemini.json`. FAST permite 5 llamadas/$1 por contenido; el ciclo admite 8 llamadas/$2 y procesa como máximo 2 candidatos y 1 publicación. Las reservas de entrada incluyen un límite conservador por bytes del PNG de QA; no representan tokens facturados. Se registra uso de entrada, caché, salida y thinking; thinking se incluye en el costo de salida. Una reserva sin uso confirmado sigue contando. Una falla no se vuelve gratuita.

La tabla de Gemini verifica precios estándar pagos del 25-10-2026. Vence el 31-12-2026 y bloquea nuevas ejecuciones hasta actualizarla; no asumir que una tarifa promocional dura indefinidamente. Cambiar un modelo exige agregar su precio verificado. Fuentes: [modelo](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [precios](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.8-flash), [JSON estructurado](https://ai.google.dev/gemini-api/docs/structured-output), [SDK](https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html).

## Fuente y cola

`ContentSourceProvider.discover()` devuelve envelopes `ContentCandidate`. Están implementados `FixtureContentSource` y `ManualQueueContentSource`; las interfaces `PoloConnectDataSource` y `ExternalPoloSources` quedan listas para adaptadores posteriores. No hay scraping ni investigación automática de fuentes externas en esta versión.

Partir de `fixtures/automation/result.example.json`. El ejemplo contiene un resultado **ficticio**, ledger de hechos/fuentes y `render_facts` con equipos, score, torneo y etapa. Para un evento real reemplazar todo el evento por hechos comprobados y fuentes primarias reales; marcar `simulated=false`. El sistema valida los contratos y la coherencia del ledger; la persona que ingresa el evento se identifica como responsable de su verificación. Declarar una URL no prueba por sí mismo que su contenido sea cierto.

```powershell
npm.cmd run cm:queue:add -- --input fixtures/automation/result.example.json --actor Seba --authorize-auto
npm.cmd run cm:auto-cycle
npm.cmd run cm:auto-status
npm.cmd run cm:queue:remove -- --id CANDIDATE_KEY --actor Seba
```

`--authorize-auto` autoriza ese input para la política; **no aprueba el render ni fuerza publicación**. Se toma sólo del comando humano, nunca del JSON ni de Gemini. En `manual`, agregar `--approve-production` para autorizar su producción; publicar exige además el flujo manual de aprobación por hash. Sin consentimiento, la pieza queda `needs_human_approval`.

Los assets opcionales deben ser archivos dentro del proyecto, con hash y derechos. Sin foto se usa el icono aprobado de la marca y una composición editorial; no se fabrican imágenes deportivas. La key de deduplicación incluye evento, hechos, fuentes, derechos, assets, consentimiento y timing, y se fija en los metadatos antes de QA. Cambiarlos invalida la autorización del paquete. Reingresar el mismo input no agrega otra entrada; las ejecuciones posteriores reutilizan la pieza vigente y el recibo existente.

## Alcance de la política

La primera integración automática admite **resultados confirmados `match_result`, una imagen feed**. Fixture deportivo, inicio de partido, replay, Stories, carousels y Reels requieren adaptadores y quedan para revisión humana: el renderer de publicación actual no puede certificar todavía sus datos y formatos. El renderer visual independiente sigue ofreciendo sus otras superficies.

La política revisa hechos, derechos vigentes/plataforma, cuenta/superficie, assets actuales/hash, copy y versiones, QA visual independiente sobre el archivo final, ledger, vencimiento, duplicados, publicaciones inciertas, saturación, separación entre posts, presupuesto y horario. Un pass de QA no basta. Rumores, opinión, ambigüedad, sensibilidad o derechos inciertos van a humano. Un resultado sensible sólo puede programarse con una aprobación humana vigente ligada al paquete; no se deduce aprobación del texto de la fuente.

| Modo | Producción | Publicación |
|---|---|---|
| manual | requiere permiso de producción en la cola | aprobación humana y comando manual |
| supervised (default) | automática | espera aprobación humana |
| automatic | automática | sólo con política `auto_publish` y switches habilitados |

Para publicación automática real se requieren `AUTOMATION_MODE=automatic`, `ENABLE_AUTO_PUBLISH=true`, `ENABLE_REAL_PUBLISHING=true`, `AUTOMATION_DRY_RUN=false`, permiso del input y política vigente. Los antiguos flags genéricos `ENABLE_AUTO_APPROVAL`, `ENABLE_AUTO_RENDER`, `ENABLE_EXTERNAL_FETCHING` permanecen en false; no controlan este nuevo ciclo local. El switch se relee al evaluar y justo antes de publicar. En ejecución local se leen las variables del proceso; cambiar el archivo `.env` afecta al siguiente proceso, no al proceso ya iniciado.

`config/automation.json`: zona `America/Argentina/Buenos_Aires`, ventanas todos los días 09:00–22:00, máximo 4 posts/24 h, intervalo mínimo 60 minutos, lease 30 minutos. Se soportan ventanas nocturnas. Los resultados pueden omitir la ventana ordinaria mediante `bypassWindowEventTypes`; los límites de frecuencia, hechos y derechos siguen activos.

Timing en el envelope:

```json
{"timing":{"mode":"publish_now"}}
{"timing":{"mode":"scheduled_at","at":"2026-10-28T18:00:00-03:00"}}
{"timing":{"mode":"hold_until","at":"2026-10-28T18:00:00-03:00"}}
```

Los timestamps requieren offset. Un momento futuro produce `hold` y se reconsidera en otro ciclo; no deja un timer esperando.

## Pruebas A / B / C

Configurar Gemini, conectar Instagram con `cm:instagram:connect` y completar S3 según [la guía existente](INSTAGRAM_PUBLISHING.md). Fijar `AUTOMATION_INSTAGRAM_ACCOUNT_ID` al ID numérico de la cuenta correcta (o dejar que se obtenga de la conexión). No confundirlo con un username. Un dry run B usa realmente S3 y crea/verifica un contenedor Meta; omite exclusivamente `media_publish`.

**A.** Con `supervised`, `AUTOMATION_DRY_RUN=true`, `ENABLE_AUTO_PUBLISH=false`: ingresar evento y correr `cm:auto-cycle`. Debe generar/renderizar, pasar QA y quedar pendiente de aprobación, sin publicación.

**B.** Conservar el mismo input. Cambiar a `automatic`, mantener dry run true y habilitar `ENABLE_AUTO_PUBLISH=true`. Ejecutar el ciclo: el reporte debe indicar `would_publish=true`, contentId, caption, asset, target y razones. Sube el JPEG y espera `FINISHED`, pero jamás llama a `media_publish`. Repetir reutiliza el contenedor durante su vigencia; el contenedor no publicado vence. `ENABLE_REAL_PUBLISHING` puede seguir false en B.

Para el ejemplo ficticio se necesita además `AUTOMATION_ALLOW_FICTITIOUS=true`; su caption y gráfico deben identificar los datos como ficticios. Mantener false para operación normal con eventos reales.

**C. Sólo después de que el usuario apruebe el reporte B:** configurar `AUTOMATION_DRY_RUN=false` y `ENABLE_REAL_PUBLISHING=true`. El ciclo debe crear el recibo de Instagram y conservar media ID, contenedor, permalink, versiones y hashes. Repetir el mismo input debe saltarlo sin otro `media_publish`.

Las pruebas unitarias A/B/C usan HTTP simulado, no equivalen a esta validación real. Mientras no existan credenciales y aprobación de B, el cierre con publicación real sigue pendiente.

Una respuesta ambigua a `media_publish` queda `unknown`, bloquea nuevos autoposts en esa cuenta y requiere `cm:instagram:reconcile`; nunca se reintenta a ciegas. El ledger conserva las llamadas y reservas aunque una transacción editorial falle. Un lease activo evita dos ciclos simultáneos; tras vencimiento el ciclo anterior queda `interrupted`. Los candidatos se rotan por última actualización para que un hold no monopolice la cola.

## Reportes y mantenimiento

Cada ciclo persiste `discovered`, `generated`, `skipped`, `duplicate`, `held`, `approval_required`, `auto_approved_by_policy`, `published`, `failed`, llamadas y costo, más entradas con resultado/razones/asset/copy/cuenta. `auto_approved_by_policy` cuenta también las decisiones aprobadas para staging en B; las autorizaciones reales se guardan separadamente. `simulated=true` identifica fixtures o HTTP de prueba. El ciclo puede terminar correctamente con items retenidos; fallas generan código de salida 1.

Los reportes JSON van a `outputs/automation-reports` y al mismo repositorio del CM; `cm:auto-status` muestra los últimos 10. Cola, decisiones, leases, aprobaciones y recibos sobreviven reinicios en archivo o PostgreSQL (aggregate JSON de Prisma). La publicación real conserva además su proyección relacional existente.

```powershell
npm.cmd run cm:auto-cycle -- --fixture --file .local/automation-preview.json
npm.cmd run test:automation
npm.cmd run verify
npm.cmd run test:postgres
```

El preview fixture genera píxeles reales con decisiones/QA simuladas. La política lo retiene: no se presenta como QA real ni como `would_publish=true`. Nunca cambiar un flag para convertir ese QA simulado en autorización real.

`cm:instagram:cleanup` elimina media de publicaciones y dry runs después de la retención, respetando referencias persistidas. Configurar además un lifecycle en el prefijo S3 para objetos huérfanos por interrupciones entre upload y checkpoint. No limpiar objetos de publicaciones inciertas hasta reconciliarlas. Persistir el journal y renders; no borrar un lock o reservas pendientes sin verificar que el proceso anterior terminó.

## Railway Cron (sin desplegar)

Se incluyen `Dockerfile`, `.dockerignore` y `railway.json`. El Dockerfile instala Node 24, Python/validadores, dependencias y Chromium. Railway ejecuta `npm run cm:auto-cycle`, restart policy `NEVER`. No usar un servidor HTTP permanente para este servicio.

1. Crear servicio Cron en Railway desde el repositorio. En su Dashboard fijar **Cron Schedule `*/15 * * * *`** (cada 15 minutos). UTC. Se deja `cronSchedule` fuera de `railway.json` para que la frecuencia del Dashboard se pueda cambiar sin editar código.
2. Añadir PostgreSQL y `REPOSITORY=postgres`, `DATABASE_URL` desde su referencia; aplicar `npm run db:migrate` como preparación del servicio antes del primer ciclo.
3. Montar volumen en **`/app/.local`** (dentro del workspace permitido por el renderer). Configurar `AI_USAGE_JOURNAL_FILE=/app/.local/ai-usage.jsonl`, `AUTOMATION_RENDER_DIRECTORY=/app/.local/automation-renders`, `AUTOMATION_REPORT_DIRECTORY=/app/.local/automation-reports`. No usar `/data` fuera del workspace para renders: el guard de paths lo rechaza.
4. Variables: Gemini/key/modelos, cuenta Instagram/token profesional/permisos/fecha de vencimiento, versión API y S3/AWS. Para ejecución sin navegador usar las variables `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_TOKEN_EXPIRES_AT` de la conexión autorizada; o un vault cifrado portable con su clave en variables y archivos en el volumen. No copiar secretos al repositorio ni a la imagen Docker.
5. Empezar con `supervised`, dry run true, ambos switches de publicación false. Ingresar la cola usando el **mismo PostgreSQL** con `cm:queue:add`. Completar A y B, revisar el reporte y recién después autorizar C. Un cron puede ejecutar A/B; B crea contenedores, nunca posts.
6. Revisar tiempo de ejecución, límites Gemini/Meta, expiración del token y costos. Si un job sigue activo, Railway omite la siguiente ejecución; no mata automáticamente procesos colgados. El lease local y los timeouts no reemplazan el monitoreo operativo. Cambiar a intervalos mayores si el ciclo demora más de 15 minutos.

No se desplegó nada ni se provisionaron recursos. Fuentes oficiales: [Cron jobs (UTC, intervalos y salida)](https://docs.railway.com/cron-jobs), [config as code y precedencia](https://docs.railway.com/config-as-code/reference).
