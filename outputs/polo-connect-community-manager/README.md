# Polo Connect Community Manager

Columna vertebral editorial modular: TypeScript, Node.js, Prisma/PostgreSQL, JSON Schema 2020-12 con Ajv y los validadores Python originales de las nueve Skills. Incluye persistencia local por archivos, versionado, QA, aprobación humana, mocks, CLI, trazabilidad y feedback de performance.

**Esta versión sólo ejecuta proveedores mock.** No incluye transportes hacia Meta, Metricool ni modelos remotos. El ejecutor local produce contratos de fixtures ficticios; no hace investigación ni juicios editoriales reales. Los renders son referencias `mock://`, no archivos gráficos/videos. Todas las salidas de demo se identifican como simuladas.

## Inicio local

Requisitos: Node 22.12+ y Python 3.10+. En PowerShell puede ser necesario escribir `npm.cmd` en lugar de `npm`. Ejecutar desde esta carpeta.

```sh
npm ci
npm run db:generate
python -m pip install -r requirements-dev.txt
npm run skills:check
npm run typecheck
npm test
npm run build
npm run cm:demo
```

El launcher detecta el Python bundled de Codex en Windows. Si Python está en otra ubicación, definir `PYTHON_EXECUTABLE`. `PyYAML` es necesario para los checks de formato; los validadores editoriales de runtime sólo usan la biblioteca estándar. No hace falta PostgreSQL para el demo local.

`cm:demo` termina en `pending_approval`. Inspeccionar y copiar el ID y hash que imprime:

```sh
npm run cm:inspect -- --id CONTENT_ID
npm run cm:approve -- --id CONTENT_ID --actor TU_NOMBRE --hash PACKAGE_HASH
npm run cm:publish:mock -- --id CONTENT_ID
npm run cm:analyze -- --id CONTENT_ID
npm run cm:strategy
```

Para autorizar explícitamente el recorrido completo **con datos ficticios** en un archivo local aislado:

```sh
npm run cm:full-demo -- --approve-demo --actor TU_NOMBRE
```

Sin `--approve-demo`, el recorrido se detiene para aprobación. La opción no activa autoaprobación ni sirve para publicar en redes. La CLI registra actor, hash y versiones. El sistema confía en la identidad introducida por el operador local: no hay autenticación multiusuario todavía.

## Workflows

`cm:discover`, `cm:opportunity`, `cm:produce`, `cm:qa`, `cm:approve`, `cm:reject`, `cm:publish:mock`, `cm:analyze`, `cm:strategy`, `cm:inspect`. Usar `--id`, `--event`, `--format single_image|reel|carousel|story`, `--file`, `--actor`, `--hash` según corresponda. `cm:produce` también admite ID de oportunidad.

La aprobación nunca se deriva de una decisión de la IA. Editar copy, CTA, headline, sponsor, assets o metadata mediante el servicio crea versiones e invalida revisión/aprobación. Una corrección del evento invalida todos los contenidos dependientes. Los originales permanecen inspeccionables.

## PostgreSQL

```sh
docker compose -f docker/compose.yml up -d
```

Copiar `.env.example` a `.env`, definir `REPOSITORY=postgres` y `DATABASE_URL=postgresql://polo_local@127.0.0.1:54329/polo_connect?schema=public`. La composición usa autenticación local `trust` y sólo expone loopback; es un entorno de desarrollo. Para Prisma CLI definir también `DATABASE_URL` en el entorno o en `.env`.

```sh
npm run db:migrate
npm run cm:demo
```

Alternativamente, `npm run test:postgres` inicia PostgreSQL temporal en loopback con credenciales efímeras generadas en memoria, aplica la migración y verifica pipeline, proyecciones, concurrencia y reinicio, sin Docker. Descarga binarios al instalar las dependencias de desarrollo y requiere permiso local para ejecutar PostgreSQL.

## Skills

Las nueve carpetas en `skills/` conservan instrucciones, referencias, schemas, tests y validadores. Se agregaron metadatos `agents/openai.yaml` con `skill-creator` y se normalizaron comillas YAML de `description`. `skills/manifest.json` registra hashes de los archivos originales y normalizados. No se unificaron Skills ni se modificaron sus reglas funcionales.

```sh
npm run skills:install
npm run skills:types
```

La instalación conserva cualquier Skill local divergente y se detiene para evitar sobrescribirla. Las Skills ya instaladas pueden requerir un nuevo chat para aparecer en el catálogo de Codex.

## Validación

```sh
npm run verify
npm run test:postgres
```

`verify` ejecuta validadores/tests originales, lint, typecheck, tests del sistema, build y demo completo con autorización ficticia explícita del harness `fixture-validation`. Ver [VALIDATION.md](docs/VALIDATION.md) para los resultados de la entrega.

Detalles: [arquitectura](docs/ARCHITECTURE.md), [workflows](docs/WORKFLOWS.md), [integraciones](docs/INTEGRATIONS.md), [desarrollo](docs/DEVELOPMENT.md). Para inspeccionar un recorrido ya ejecutado: [traza completa ficticia](examples/demo-trace.json).

Próximo paso: aportar brand system, material con derechos y un ejecutor editorial real autorizado. Validar sus resultados contra los mismos contratos antes de agregar proveedores de producción.
