# Iteración 2 — Polo Connect Community Manager

Fecha: 25 de octubre de 2026. Desarrollo y pruebas ejecutados en Windows, sobre el repositorio real.

## Entorno

| Componente | Resultado |
|---|---|
| Node | 24.16.0 |
| npm | 11.13.0 |
| Python | CPython oficial estable 3.14.3; `.venv` local, pip 25.3 |
| Git | 2.53.0.windows.2 |
| PowerShell | 7.6.5 |
| winget | 1.29.380 |
| Prisma | 6.19.3; cliente regenerado |
| Docker | Cliente detectado; no se instaló ni fue necesario para validar PostgreSQL |

Python ya existía fuera del PATH heredado. Se aprovecharon esa instalación y un entorno virtual, sin instalar paquetes Python globales. Se agregaron sus directorios oficiales al PATH de usuario. Terminales abiertas pueden conservar el PATH anterior; el launcher del proyecto resuelve `.venv` directamente.

Ubicación: `C:\Users\sebas\Documents\Codex\2026-10-24\files-mentioned-by-the-user-polo`. Se conserva el nombre físico para mantener la asociación del chat; esta carpeta es ahora la raíz real de desarrollo.

## Repositorio y preservación

Antes: aplicación dentro de `outputs/polo-connect-community-manager/`, con `work/` y entregables en la raíz Git.

Ahora: `src/`, `skills/`, `tests/`, `prisma/`, `docs/`, `fixtures/`, `scripts/`, `config/`, `brand/`, `assets/`, `docker/`, `examples/`, `package.json`, lockfile, requirements y configuración directamente en la raíz Git.

Los artefactos previos quedaron archivados en `C:\Users\sebas\Documents\Codex\2026-10-24\polo-connect-archive-20261024`, con `before-move-sha256.json`. Se comprobaron los archivos originales mediante SHA-256 antes de editar la aplicación. Se mantuvieron `.git` y el historial; no se creó commit ni se alteró el remoto. Git mostrará las eliminaciones de las rutas antiguas y los nuevos archivos hasta que se prepare el siguiente commit.

Se conservan las nueve Skills originales, sus schemas, referencias, tests y validadores Python. El runtime adapta el transporte OpenAI sin cambiar esos contratos editoriales. El lockfile se actualizó por la incorporación explícita de `openai@7.43.0`.

## Validación previa

Antes de implementar IA se ejecutaron correctamente `skills:check`, lint, typecheck, los 26 tests TypeScript originales, build, safety, verify, demo normal y full demo fixture. Evidencia local: `.local/baseline-results.json` y logs `baseline-*`.

La reinstalación final encontró archivos de Prisma/PostgreSQL bloqueados por procesos de pruebas previas. Se cerraron únicamente esos procesos identificados del proyecto y se apartó el directorio de dependencias previo dentro de `.local/`. Luego `npm ci` terminó correctamente: 228 paquetes, auditoría sin vulnerabilidades. Prisma volvió a generarse. Se corrigió el cierre del PostgreSQL temporal de Windows usando `pg_ctl` sobre el cluster de prueba específico.

## Resultados de la prueba final

| Check | Resultado |
|---|---|
| `npm ci` y `db:generate` | Correctos; auditoría npm 0 vulnerabilidades |
| Nueve Skills, integridad y validadores | Correctos; 64 tests originales |
| Suite TypeScript | 53 tests, 8 archivos, todos aprobados |
| Tests originales del sistema | Los 26 originales permanecen incluidos y pasan |
| Nuevos tests | 27 adicionales; cubren los 23 casos obligatorios, SDK/codec, gates y SkillCore |
| `test:governance` independiente | 25/25 aprobados, incluido chequeo de redacción de secretos y flags |
| Lint / typecheck / build / safety | Correctos |
| `npm run verify` | Exit 0; incluye full demo fixture |
| PostgreSQL real temporal | Exit 0; ambas migraciones, pipeline, proyecciones, concurrencia, reconexión y cierre |
| `doctor`, `cm:ai:check`, `cm:context-preview`, `cm:usage` | Exit 0 |
| Demo fixture normal | `ready_for_human_approval` / `pending_approval`; 0 USD IA |
| Full demo fixture | `analyzed`; 7 ejecuciones de Skills fixture, publicación mock, 0 USD IA |
| AI demo deshabilitado | Rechazo esperado `ENABLE_REAL_AI=true is required`, sin llamada al proveedor |

El preview comprobado hizo cero llamadas y mostró cinco referencias para opportunity detector, perfil FAST, estimación 9573 tokens y reserva conservadora 32271. Es una medición del fixture actual, no un tamaño universal ni uso API real. El ledger AI está vacío: cero llamadas reales, métricas/costo desconocidos `null`, sin inventar ceros de tokens.

Evidencia local reproducible en `.local/verify-final.log`, `postgres-final.log`, `npm-ci-final.log`, `prisma-final.log`, `final-cli-results.json` y `final-cm-*.log`. Los logs están ignorados por Git. El SDK se probó con transport fake; no se afirma una validación end-to-end contra el servicio remoto sin credenciales.

## Implementación del runtime

`FixtureSkillExecutor` y `CallbackSkillExecutor` siguen disponibles. `OpenAIResponsesSkillExecutor` usa SDK oficial, Responses, Structured Outputs, timeout, abort, sin herramientas ni retries internos. El runner controla validación, caché y reintentos. Se requieren tanto API key como `ENABLE_REAL_AI=true`; la mera existencia de una key no habilita nada.

Estado comprobado: IA real deshabilitada, API key ausente, modelos sin configurar, precios vacíos, mocks disponibles. Publicación, rendering externo, autoaprobación y fetching permanecen deshabilitados. Ninguna publicación real ni llamada paga se realizó.

El ejemplo AI utiliza datos ficticios previamente verificados y necesita sólo oportunidad → diseño → copy → QA. No dispara automáticamente research, benchmark, estrategia ni analytics. Benchmark es on-demand con pregunta/TTL; estrategia se reutiliza; performance espera ventana/datos salvo simulación explícita.

## Tokens, contexto y costos

| Clase | Calls | Input acumulado | Output acumulado | Tope USD |
|---|---:|---:|---:|---:|
| FAST | 5 | 120000 | 20000 | 0.50 |
| STANDARD | 10 | 240000 | 40000 | 2.00 |
| PREMIUM | 20 | 480000 | 80000 | 8.00 |

Configuración: `config/ai.json`; overrides por Skill para perfil/modelo y límites input/output por llamada. No se escala de clase automáticamente. El límite input se reserva conservadoramente con bytes UTF-8 y margen de transporte; el preview también informa una estimación aproximada de tokens. No se presenta esa reserva como uso medido ni se truncan hechos para entrar en presupuesto.

Se separan SkillCore, referencias pertinentes, contexto resumido e inputs estructurados. `config/reference-map.json` selecciona referencias de forma determinística. El contexto reciente cubre siete días y hasta veinte elementos; learnings y patrones de benchmark hasta cinco de cada uno, con señales compactas de repetición. El ledger factual necesario se conserva completo.

`WorkflowRun` guarda modelo, proveedor, clase, workflow, referencias, latencia, tokens y costos cuando están disponibles. Datos faltantes y agregados incompletos quedan `null`. `cm:usage` agrupa por contenido, Skill, workflow, día de Buenos Aires, modelo y clase. Los costos calculados se distinguen de facturación real; sólo se calculan con precios configurados. Sin tabla de precios, el tope USD bloquea antes de gastar.

Las reservas se escriben antes de cada llamada live en un journal local sincronizado, sobreviven a interrupciones y se deduplican contra runs persistidos. Una reserva sin usage se conserva para revisión, no se considera gratuita. El presupuesto incluye reintentos y llamadas fallidas; agotarlo bloquea el workflow e invalida aprobación, sin omitir QA.

Caché: inputs semánticos, fuente de verdad, Skill/schema/validadores, referencias elegidas, executor, modelo y configuración relevante. Una coincidencia registra `skill_cache_hit` sin LLM. Los tests con counting executor verifican cuatro llamadas en el primer recorrido y cero nuevas llamadas en el segundo, con cuatro hits.

## QA y límites prácticos

El gate determinístico compara ledger/score, fechas, nombres canónicos, versiones, derechos, assets, formato, CTA/link, duplicación y estado de aprobación antes de solicitar juicio editorial IA. Los renders mock no tienen píxeles: QA live puede bloquear por assets/marca o devolver revisión parcial; nunca certifica inspección visual inexistente.

El journal sirve para una instancia local compartiendo filesystem. Antes de distribuir workers entre hosts se necesita reserva transaccional compartida en PostgreSQL. No se implementó servidor público ni autenticación multiusuario.

## Comandos finales

```powershell
npm.cmd run doctor
npm.cmd run verify
npm.cmd run test:postgres
npm.cmd run test:governance
npm.cmd run cm:demo
npm.cmd run cm:full-demo -- --approve-demo --actor Seba
npm.cmd run cm:ai:check
npm.cmd run cm:context-preview
npm.cmd run cm:ai-demo
npm.cmd run cm:usage
```

El demo normal debe quedar en `ready_for_human_approval` / `pending_approval`; el full demo usa aprobación explícita de fixture y termina en `analyzed`, siempre con publicación mock y costo IA cero.

## Cómo habilitar la prueba AI pendiente

Copiar `.env.example` a `.env`, definir `ENABLE_REAL_AI=true`, `OPENAI_API_KEY` y los tres `MODEL_*` con IDs disponibles en la cuenta. Completar `config/pricing.json` con precios oficiales verificados por millón de tokens para input/cachedInput/output y actualizar su versión. Mantener las otras cuatro flags en false. Revisar el preview y ejecutar `cm:ai-demo`; repetir el mismo comando para verificar caché. No se ejecutó esta prueba contra OpenAI porque no existe credencial configurada; no hay mediciones reales de tokens/costo que reportar.

## Pendientes autorizados para futuras iteraciones

Validación live contra OpenAI tras configurar credenciales/modelos/precios; assets y brand system aprobados; rendering real; fuentes externas; almacenamiento externo; publicación Meta/Metricool y analytics reales. Ninguna de estas integraciones se habilitó en esta iteración.
