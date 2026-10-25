# CM_PoloConnect — Polo Connect Community Manager

Proyecto de desarrollo en la raíz Git. TypeScript/Node, Prisma/PostgreSQL, repositorio de archivos, nueve Skills independientes, contratos JSON Schema/Ajv, validadores Python, estado explícito, versionado, QA, aprobación humana y trazabilidad.

## Sistema visual local

Los dos logos aportados están registrados sin alteraciones. Hay tokens de marca derivados, tipografía editorial provisional Barlow, 32 variantes de composición, RenderSpec cerrado y renderer HTML/CSS + Chromium. Exporta PNG/JPG reales, con comprobaciones de derechos, score, contraste, overflow, aspect ratio y safe areas. Los mocks anteriores se conservan.

```powershell
npm.cmd run render:install
npm.cmd run cm:render-demo
npm.cmd run cm:gallery
npm.cmd run test:render
```

Abrir `outputs/render-demo/index.html` para comparar familias, temas y tamaños. El demo usa datos ficticios y placeholders identificados porque aún no se aportó foto deportiva; no genera caballos/jugadores. No publica ni aprueba. El Quality Reviewer recibe el PNG final; el executor fixture no equivale a una inspección IA ejecutada. El modo remoto requiere habilitación explícita y presupuesto: `npm.cmd run cm:render-demo -- --real-ai`.

Para ingresar resultado + foto autorizada: partir de `fixtures/render/result.input.example.json`, agregar fuente/crédito/derechos de `photo` y ejecutar `npm.cmd run cm:render -- --input "C:/ruta/resultado-verificado.json"`. Los datos deben llegar verificados; el renderer no realiza investigación. Sin `--real-ai`, planning es fixture y el render no gasta tokens. [Manual visual, contratos y límites](docs/VISUAL_SYSTEM.md).

## Entorno Windows

Node >=22.12 y Python >=3.10. Se detectó CPython oficial estable 3.14.3 y se creó `.venv` local. `scripts/python.mjs` resuelve `PYTHON_EXECUTABLE`, `.venv`, `python`, `py`, `python3`, instalaciones Windows y finalmente el runtime bundled. No necesita que una terminal antigua haya actualizado su PATH. Las dependencias Python se instalan en `.venv`, sin paquetes globales nuevos.

Desde esta carpeta, que ahora contiene `package.json` y `package-lock.json`:

```powershell
npm.cmd ci
npm.cmd run db:generate
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
npm.cmd run verify
npm.cmd run test:postgres
```

Para crear el venv en otro equipo: `py -3 -m venv .venv` o `python -m venv .venv`. `npm.cmd` evita problemas con la política de scripts PowerShell; `npm` también sirve si está habilitado.

## Modo 1 — Fixture

```powershell
npm.cmd run cm:demo
```

Costo IA: **0 USD**. Se detiene en `ready_for_human_approval` / `pending_approval`. Fuentes, renders y analytics son ficticios. Ninguna integración social real está implementada.

El recorrido completo necesita una autorización CLI explícita, limitada al fixture:

```powershell
npm.cmd run cm:full-demo -- --approve-demo --actor Seba
```

Termina en `analyzed` con publicación mock, learning y revisión estratégica. Esto no activa autoaprobación. Una aprobación normal exige `--actor` y el `--hash` del paquete inspeccionado:

```powershell
npm.cmd run cm:inspect -- --id CONTENT_ID
npm.cmd run cm:approve -- --id CONTENT_ID --actor Seba --hash PACKAGE_HASH
npm.cmd run cm:publish:mock -- --id CONTENT_ID
```

## Modo 2 — AI dry-run

```powershell
npm.cmd run cm:ai:check
npm.cmd run cm:context-preview
npm.cmd run cm:ai-demo
npm.cmd run cm:usage
```

`cm:ai-demo` usa Responses con el SDK oficial OpenAI, evento ficticio **ya verificado**, estrategia persistida y assets/renders mock. Sólo ejecuta las decisiones necesarias: oportunidad → diseño → copy → QA. No invoca research, benchmark, estrategia ni performance por publicación. No aprueba ni publica. Se guarda en `.local/ai-demo.json`; un segundo recorrido idéntico reutiliza dependencias/cache y conserva un ledger acumulado.

Para habilitarlo:

1. Copiar `.env.example` a `.env`.
2. Definir `ENABLE_REAL_AI=true`, `OPENAI_API_KEY` y modelos disponibles en tu cuenta en `MODEL_FAST`, `MODEL_STANDARD` y `MODEL_PREMIUM`.
3. En `config/pricing.json`, agregar para cada modelo sus precios **verificados** por millón de tokens en `input`, `cachedInput`, `output`; actualizar `version`. Ver la [tabla oficial de precios](https://developers.openai.com/api/docs/pricing). Los precios empiezan vacíos deliberadamente.
4. Mantener publicación, autoaprobación, rendering externo y fetching en `false`.
5. Revisar `cm:context-preview` y luego ejecutar `cm:ai-demo`.

Formato de precios, sin precios inventados en el ejemplo:

```json
{"version":"FECHA_DE_VERIFICACION","models":{"ID_CONFIGURADO":{"input":"NUMERO_OFICIAL","cachedInput":"NUMERO_OFICIAL","output":"NUMERO_OFICIAL"}}}
```

**Reemplazar los marcadores por números de precios oficiales comprobados (sin comillas)**. El ejemplo no es una configuración ejecutable; no usar ceros para simular una tarifa real gratuita. El límite en dólares bloquea antes de llamar si falta precio. No hay selección implícita de modelo ni habilitación automática por mera presencia de una API key.

El preview es de sólo lectura y no llama al modelo. Admite `--id`, `--file`, `--skill` y `--show-prompt`. Muestra modelo/perfil, referencias, razón de ejecución, bytes/tokens estimados, reserva conservadora, presupuesto restante y cache hit probable.

Los mocks no contienen píxeles revisables. El dry-run real puede finalizar con un blocker de marca/assets o un QA parcial/pre-render: jamás se certifica calidad visual de un archivo que no existe ni se publica contenido incompleto.

## Gobernanza de consumo

| Clase | Máximo de llamadas | Input acumulado | Output acumulado | Tope USD |
|---|---:|---:|---:|---:|
| FAST | 5 | 120000 | 20000 | 0.50 |
| STANDARD | 10 | 240000 | 40000 | 2.00 |
| PREMIUM | 20 | 480000 | 80000 | 8.00 |

Todo se configura en `config/ai.json`, incluidos límites por llamada/Skill, modelos por perfil, timeout y cantidad de registros de contexto. Los límites amplios de input son **reservas conservadoras en bytes UTF-8**, no tokens consumidos. La estimación de tokens se muestra aparte; uso real y cached tokens provienen de la respuesta API, o quedan `null`.

`blocked_budget` conserva hechos y trabajo válido, invalida aprobación y requiere revisión humana. No se cambia de clase automáticamente ni se omite verificación o QA. Los reintentos gastan del mismo presupuesto. El SDK tiene retries desactivados: el único límite de reintentos está en el runner.

`WorkflowRun` registra modelo/proveedor, tokens, latencia, costos reales o estimados, referencias, clase y workflow. `cm:usage` agrupa por contenido, Skill, workflow, día de Buenos Aires, modelo y clase. Los totales incompletos quedan `null`. Un journal previo `.local/ai-usage.jsonl` conserva reservas ante interrupciones; reservas sin reconciliar no se consideran gratuitas.

## Modo 3 — Producción futura

No habilitado. Publicación sigue siendo `MockPublishingProvider`; fuentes son fixtures y no hay Meta, Metricool, Canva, Adobe, S3 ni scraping real. Las cuatro flags de efectos externos se rechazan si se intentan activar. IA real es una capacidad independiente.

## PostgreSQL

`npm run test:postgres` inicia PostgreSQL real temporal en loopback, aplica ambas migraciones y prueba pipeline, proyecciones, concurrencia y reconexión. No necesita Docker. Opcionalmente:

```powershell
docker compose -f docker/compose.yml up -d
```

Configurar `REPOSITORY=postgres` y `DATABASE_URL=postgresql://polo_local@127.0.0.1:54329/polo_connect?schema=public`; luego `npm run db:migrate`. La composición usa trust sólo en loopback para desarrollo. El AI dry-run usa exclusivamente archivo local aislado.

## Workflows y checks

```powershell
npm.cmd run skills:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:governance
npm.cmd run build
npm.cmd run safety:check
npm.cmd run verify
npm.cmd run test:postgres
```

Además: `cm:discover`, `cm:opportunity`, `cm:produce`, `cm:qa`, `cm:approve`, `cm:reject`, `cm:analyze`, `cm:strategy`, `cm:benchmark -- --question "PREGUNTA"`. Benchmark es explícito y tiene TTL; la estrategia no se recalcula por post y los analytics esperan ventana/datos salvo fixtures declarados. No hay scheduler en background.

Se conservan las nueve Skills y sus 64 tests originales, schemas, referencias y validadores. `skills:types` regenera tipos y `skills:install` conserva instalaciones divergentes. No se alteraron los contratos editoriales para ajustarlos a OpenAI: un codec de transporte estricto conserva campos opcionales/diccionarios y luego valida el objeto contra el schema original y Python.

Detalles en [AI_RUNTIME.md](docs/AI_RUNTIME.md), [ARCHITECTURE.md](docs/ARCHITECTURE.md), [WORKFLOWS.md](docs/WORKFLOWS.md), [INTEGRATIONS.md](docs/INTEGRATIONS.md), [DEVELOPMENT.md](docs/DEVELOPMENT.md) y el [reporte de esta iteración](docs/ITERATION-2-REPORT.md).
