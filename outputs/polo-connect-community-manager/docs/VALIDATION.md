# Validación de entrega — 24 de octubre de 2026

| Verificación | Resultado |
|---|---|
| Formato actual de las nueve Skills (`quick_validate.py`) | 9/9 válidas |
| Integridad de referencias, schemas, tests y validadores originales | Verificada por SHA-256; sólo frontmatter normalizado y metadata UI agregada |
| Tests Python originales | 64 aprobados |
| Validadores editoriales sobre outputs demo | 9/9 aprobados |
| Tests del nuevo sistema | 26 aprobados, en cuatro suites |
| Lint | Sin errores ni warnings |
| Typecheck | Correcto |
| Build TypeScript | Correcto |
| Migración sobre PostgreSQL real temporal | Correcta |
| Pipeline completo sobre PostgreSQL | Correcto; publicación exclusivamente mock |
| Proyecciones relacionales, concurrencia y recuperación al reconectar | Correctas |
| Demo CLI completo | Termina en `analyzed`, con un learning y revisión de estrategia |
| Publicación real / autoaprobación / render real / fetching externo | Desactivados; configuración rechaza su activación |
| Transportes HTTP en código de aplicación | No detectados |
| Patrones de secretos en archivos del proyecto | No detectados |
| Auditoría npm del lockfile entregado | 0 vulnerabilidades reportadas |

Los ocho escenarios solicitados se ejecutan en `tests/integration.test.ts`: resultado confirmado, rumor, footage sin derechos, corrección de score, QA contradictorio con owner correcto, edición material y reaprobación, analytics/learning/feedback y deduplicación multifuente. Se agregan rama Reel, reutilización de planes, validación de contratos, retries acotados, routing, cambios de assets/sponsor/CTA, derechos por plataforma, rechazo humano y persistencia/reinicio.

El test de PostgreSQL ejecuta un servidor PostgreSQL real temporal en loopback y usa Prisma; no simula la base ni requiere Docker. Docker estaba instalado pero su motor no estaba activo en el entorno de entrega. Se verificó el adapter de base con el servidor temporal.

El demo registra una aprobación explícita del operador/harness mediante `--approve-demo --actor fixture-validation`. Esa aprobación corresponde exclusivamente a datos ficticios. `cm:demo` sin esa autorización se detiene en `pending_approval`. Los checks visuales y las métricas del fixture no certifican calidad ni performance de media real.

El análisis de secretos usa patrones conocidos y redacción preventiva; su resultado expresa que no se detectaron esos patrones. El proyecto no incorpora credenciales de cuentas reales. Las únicas credenciales del test PostgreSQL se generan efímeramente y no se imprimen ni se guardan en el repositorio.

## Reproducir

```sh
npm run verify
npm run test:postgres
npm audit
```

El código, los fixtures, las migraciones y el lockfile se incluyen en el ZIP. Dependencias, clusters temporales, archivos de trabajo, caches y credenciales no forman parte del paquete. [demo-trace.json](../examples/demo-trace.json) permite inspeccionar objetos, versiones, ejecuciones y transiciones de un recorrido completo sin volver a ejecutarlo.
