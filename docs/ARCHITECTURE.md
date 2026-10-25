# Arquitectura

## Módulos

| Capa | Código | Responsabilidad |
|---|---|---|
| Conocimiento editorial | `skills/*` | Procesos especializados originales; nueve dominios separados |
| Contratos/ejecución | `src/skills/` | Bundle con instrucciones, referencias y schema, ejecutor intercambiable, validación doble, hashes, reintentos |
| Dominio | `src/domain/` | Estados, versiones, assets, derechos y gates de publicación |
| Orquestación | `src/orchestration/` | Enrutamiento, dependencias, transacciones, invalidación y feedback |
| Aprobaciones | `src/approvals/` | Hash del paquete, identidad, instante y versión revisada/aprobada |
| Integraciones | `src/providers/` | Puertos; implementaciones locales exclusivamente en `mock/` |
| Persistencia | `src/persistence/`, `prisma/` | Memoria para tests, archivos atómicos para local, Prisma/PostgreSQL |
| Configuración | `src/config/`, `config/`, `brand/` | Defaults seguros; identidad visual marcada como faltante |
| Operación | `src/cli.ts` | Comandos inspeccionables sin panel administrativo |

No hay reglas de tono, scoring creativo ni análisis causal duplicadas dentro del orquestador. El fixture executor es un test double declarado; su comportamiento no reemplaza la inteligencia de las Skills. `CallbackSkillExecutor` permite conectar un runner que reciba el bundle completo y contexto estructurado, sin convertir las nueve especialidades en un mega-prompt.

## Persistencia y transacciones

Cada operación de servicio es una transacción. `StateStore` contiene el agregado recuperable y `PrismaRepository` actualiza sus proyecciones relacionales en la misma transacción: eventos, contenidos, oportunidades, planes, versiones de copy/assets/metadata, QA, aprobaciones, publicaciones, snapshots, learnings, ejecuciones, auditoría, estrategia y benchmarks. Assets son referencias versionadas agrupadas por pieza; no se guardan binarios en PostgreSQL ni Git.

PostgreSQL usa un advisory lock transaccional para serializar escritores del workspace editorial. Las proyecciones tienen claves únicas para evento lógico, versiones y publicación idempotente. Los readers sólo ven commits completos. La implementación inicial trabaja con un único workspace y serializa operaciones; antes de escalar a muchos tenants o workers conviene dividir agregados por contenido/evento, usar concurrencia optimista por agregado y una cola durable. Los IDs y proyecciones actuales son globales a la base.

El repositorio de archivos usa exclusión con `.lock`, escritura temporal y rename. Otro escritor recibe `retryable_error`, sin esperar indefinidamente. Tras un cierre abrupto puede quedar un lock: verificar que no haya proceso activo antes de retirarlo manualmente. No es un sustituto de PostgreSQL para varios operadores. Nunca devolver referencias mutables al estado interno.

Si una operación falla, revierte cambios de dominio y conserva las ejecuciones realizadas y la auditoría de error. Una ejecución de una pieza nueva que todavía no se persistió queda con `contentId=null`; su contexto original permanece en el input. No se reintentan errores de validación ni fallas genéricas de proveedor sin clasificación explícita como retryable.

## Versiones e identidad del paquete

Cada contenido tiene contadores `asset`, `copy`, `metadata`, `review`. Los arrays de revisiones son append-only; las revisiones previas pueden marcarse stale, pero sus datos no se sobrescriben. Un hash canónico incluye contenido, versiones creativas, plan, assets, copy y metadata. Las aprobaciones guardan ese hash y las cuatro versiones.

`review` referencia el QA de producción aprobado. El preflight posterior a la aprobación se guarda como otra revisión de QA y no cambia la referencia del QA aprobado; así no invalida circularmente la aprobación que verifica. Una edición material exige nuevo QA de producción y aprobación. Una publicación conserva su propio payload exacto, incluso si después cambia la pieza.

Todos los cambios de contenido de esta versión se consideran materiales. Esto es conservador y evita que una edición de sponsor/CTA se disfrace de metadata inocua. Las correcciones de fuentes invalidan planes, copy, renders y aprobaciones dependientes; los hechos anteriores se conservan en el historial del evento.

## Idempotencia y deduplicación

- Descubrimiento: clave canónica de evento suministrada por el adapter; coincidencia secundaria por event ID o URL normalizada sin tracking.
- Un evento lógico conserva múltiples fuentes y claims. Reportes contradictorios nuevos quedan disputed; sólo la operación explícita de corrección reemplaza hechos.
- Una pieza por evento/formato. La oportunidad se reutiliza mientras no haya blockers ni cambios materiales.
- Plan válido se reutiliza si no cambió el hash de inputs/contexto. QA y aprobación vigentes no se regeneran sin cambio.
- Caché de Skill: input + nombre/versión/modelo del ejecutor + configuración + huella de instrucciones/referencias/schema/validador.
- Publicación: content ID + hash de paquete; clave única en base. Snapshots y learning se deduplican por identidad de observación.

La coincidencia semántica compleja y la resolución de aliases entre proveedores quedan en los adapters de inteligencia; no se inventa corroboración independiente contando URLs.

## Observabilidad

`WorkflowRun` registra input/output estructurado, timestamps, duración, skill, modelo, configuración, intento, conocimiento usado y error tipado. `AuditEvent` registra transiciones, cache hits, blockers, aprobación y payload de publicación mock. `cm:inspect` muestra el agregado y sus trazas. Los inputs externos son datos sin autoridad para cambiar instrucciones, ejecutar código o habilitar integraciones. El bundle de Skill proviene del registro local de confianza.

La redacción recursiva elimina campos de secretos conocidos y patrones de URLs con credenciales/Bearer tokens. No se deben entregar secretos al contexto editorial; un futuro adapter debe leerlos en su propia frontera. La redacción no es un detector universal de secretos en texto arbitrario.

## Extensión de runtime IA

`src/ai/` separa modelos/precios, construcción de contexto, presupuestos, contabilidad/journal, codec de structured outputs y adapter Responses. `src/qa/deterministic-gate.ts` aplica verificaciones mecánicas antes de IA. El conocimiento editorial de las nueve Skills permanece intacto; únicamente se omiten del prompt los índices de discovery y references que ya resolvió el router. El core editorial y los hard gates se conservan. Los outputs cacheados dependen del core original, referencias seleccionadas, inputs y modelo. La migración `202610240002_ai_governance` agrega campos nullable de consumo sin borrar datos existentes. Más detalle en [AI_RUNTIME.md](AI_RUNTIME.md).
