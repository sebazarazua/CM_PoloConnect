# Desarrollo

## Dependencias y configuración

Node 22.12+; Python 3.10+. En Windows de este proyecto se usa `.venv` con CPython 3.14.3. Versiones fijadas en `package-lock.json`. Prisma usa la línea 6.19 para mantener el adapter clásico probado; no actualizar su major sin revisar generación, migraciones y transacciones. Ajv soporta el draft 2020-12 de los schemas originales ([documentación de Ajv](https://ajv.js.org/json-schema.html)).

Los overrides acotados a `@prisma/config` fijan versiones corregidas de `deepmerge-ts` y `effect`. Se verificaron con generación de cliente, migración y pipeline real en PostgreSQL. Vitest 5.0.5 y Ajv 8.20.0 evitan los advisories presentes en las versiones iniciales; el lockfile final arroja cero vulnerabilidades en npm audit.

`MAX_SKILL_RETRIES` y `MAX_REROUTES` son enteros entre 0 y 10. Los cuatro flags de efectos externos deben estar ausentes o ser `false`; valores ambiguos fallan cerrado. `.env` no entra en Git. La CLI carga `.env` con Node; los tests no necesitan archivo de entorno.

En Windows con Python bundled y dependencias instaladas en una carpeta separada se puede definir `PYTHONPATH` para `skills:check`. Una instalación convencional con `python -m pip install -r requirements-dev.txt` no necesita esto. El runtime sólo necesita Python estándar.

## Tests

`npm test` ejecuta tests de dominio, contratos, ocho escenarios obligatorios, rama Reel, repositorio de archivos y concurrencia de memoria. `skills:check` ejecuta `quick_validate.py` de skill-creator, los 64 tests originales sin reescribirlos y los nueve validadores de outputs. Los tests originales son funciones Python con asserts, sin fixtures de pytest; el runner las invoca directamente y propaga cualquier fallo. También pueden ejecutarse individualmente con pytest.

`npm run test:postgres` usa [embedded-postgres](https://github.com/leinelissen/embedded-postgres) como dependencia de desarrollo, con PostgreSQL real y temporal. Escoge puerto libre en loopback, genera contraseña efímera sin imprimirla, aplica migración versionada y elimina su cluster al cerrar. No crea usuarios del sistema. La carpeta temporal queda bajo `.postgres/`. No usar este harness como servicio de producción.

## Mantenimiento de Skills

`skills/manifest.json` permite verificar que referencias/schemas/tests/validadores se conservan respecto de los ZIP originales. Sólo cambia el quoting del frontmatter en `SKILL.md` y se agregan metadatos UI. `scripts/vendor/skill-creator/quick_validate.py` conserva el validador de formato utilizado en esta entrega. No contiene una copia de la Skill editorial ni lógica de producción.

Si cambia un schema, regenerar con `npm run skills:types`, actualizar fixtures legítimos y correr ambas validaciones. Si cambian instrucciones/referencias/validador, cambia la huella del bundle al construir un nuevo registro, por lo que ejecuciones nuevas no usan cachés de conocimiento anterior. Los procesos largos deben recrear `SkillRegistry` después de actualizar Skills.

## Límites deliberados

- Executors remotos Gemini (default) y OpenAI alternativo, opt-in con flag y API key. Ver `AI_RUNTIME.md`. Todos los tests usan fixtures/fakes y ningún resultado se presenta como validación contra un modelo real.
- Renderer local Chromium con PNG/JPG reales; los mock renderers anteriores conservan referencias y metadata. Sólo el QA con píxeles y executor real puede autorizar una publicación real.
- Sin autenticación, servidor público ni UI administrativa; actor local declarado.
- Un workspace serializado, agregado completo y proyecciones actualizadas por transacción. Antes de gran volumen, dividir agregados y usar workers/outbox.
- Sin scheduler dentro del proceso ni calendario conectado. Railway Cron invoca tareas cortas; Instagram manual/automático se configura en `AUTOMATION.md`.
- Deduplicación por claves/IDs/URLs y formato; no hay motor semántico ni garantía de resolver entidades de fuentes reales sin adapters.
- Re-review completo en esta versión. Se preservan las capacidades delta de la Skill original; la API de orquestación todavía no expone un merge de revisiones delta.
- Las evaluaciones de performance demo prueban trazabilidad y feedback, no efectividad de contenido ni causalidad.

## Siguiente incremento

Completar la validación A/B con Gemini y credenciales autorizadas, revisar el dry run y después realizar C en Instagram. Identidad visual, permisos por asset, cola simple, recibos y política ya están implementados. Agregar adaptadores de fuentes y formatos antes de ampliar la automatización fuera de resultados confirmados.
