# Runtime IA y presupuestos

## Routing

`classify()` asigna FAST a resultados/fixture/live/replay estructurados, STANDARD a Reel/carrusel/noticias y PREMIUM a campañas/entrevistas/reportes especiales explícitos. No hay upgrade automático. Los perfiles de modelo se configuran con `MODEL_FAST`, `MODEL_STANDARD`, `MODEL_PREMIUM`; copy/QA usan STANDARD por default incluso en un workflow FAST. La lógica de negocio no contiene IDs concretos de modelos.

La ingesta deduplica antes del runner por clave lógica, event ID, URLs normalizadas y fingerprint material. Un reporte nuevo sin verificar requiere news researcher; un import verificado exige actor identificado, ledger y ambos validadores. Una URL repetida no constituye corroboración independiente. AI demo importa evidencia declaradamente ficticia y no paga una investigación para redescubrirla.

Benchmark sólo corre para una pregunta explícita y se almacena con TTL/huella de contexto+Skill+referencias+modelo. Estrategia sólo corre en revisión explícita con evidencia nueva o ventana vencida. Los posts leen una síntesis de la estrategia persistida. Performance de datos no simulados se difiere hasta que haya ventana y métricas disponibles.

## Contexto y caché

`config/reference-map.json` selecciona referencias por Skill, formato, tipo de evento y superficie. No se leen todas las references para cada llamada. `SkillCore` conserva el proceso original; `RelevantReferences`, `TaskContext` y `StructuredInputs` son componentes separados. Las referencias no seleccionadas no alteran el fingerprint de esa ejecución.

`RecentContentSummary` limita la muestra a 20 contenidos / 7 días, conserva conteos del período y señales de repetición de evento, formato, subject, hook, serie, CTA y oportunidad. Learnings y benchmarks se ordenan por relevancia y se limitan a cinco. Estrategia se proyecta a objetivos, audiencias, pilares, capacidad y brief; no se envía el árbol histórico de outputs.

Designer, copy y QA reciben el mismo evento verificado. Los hechos centrales, entidades, horarios y fuentes no se truncan para entrar en presupuesto. Si no caben, se bloquea. El runner proyecta sólo las superficies actuales de contenido, no todas sus revisiones/publicaciones históricas.

Las dependencias por etapa guardan el hash relevante. Un cambio de core, referencia seleccionada, modelo o contexto sustantivo invalida la caché. Una corrección de copy puede reutilizar el plan/renders si siguen vigentes. Un segundo AI demo idéntico registra cuatro `skill_cache_hit` y no llama al executor.

## Contabilidad

Los límites acumulados se aplican por workflow de contenido y no se resetean por reintento ni edición. Los límites de input/output por Skill en esta versión son **por llamada**, más el perfil opcional de modelo. Los límites globales de clase siguen aplicándose. Las tareas periódicas tienen identidad de contexto independiente.

La reserva de input usa un límite superior de bytes UTF-8 del contexto/schema más overhead. La estimación legible usa una aproximación y nunca se presenta como consumo real. Output se reserva con el límite completo por llamada. No se reduce arbitrariamente una respuesta para aprovechar el último remanente.

Antes de cada llamada se comprueban calls, input, output y costo. Sin precios no hay cálculo inventado: un tope USD no verificable produce `blocked_budget`. El costo conocido por provider tendría prioridad; Responses no entrega aquí USD de facturación, por lo que se usa sólo la tabla configurada y `costSource=configured_price_estimate`. Cached input se descuenta con su tarifa configurada; reasoning ya forma parte de output y no se suma dos veces.

Uso faltante queda `null`. Una respuesta inválida o incompleta sigue registrando los tokens que el provider informó. Ante timeout/falla sin usage se conserva el máximo reservado para gobernanza, separado de los campos medidos. Los agregados incompletos también quedan `null`, acompañados de contadores de datos desconocidos.

El journal `.local/ai-usage.jsonl` escribe y sincroniza la reserva **antes** de la llamada real, con exclusión de escritores. No contiene prompts, headers ni credenciales. Si el proceso cae, la reserva sobreviviente se mantiene hasta revisión/reconciliación; no se elimina automáticamente. No borrar journal/locks para "recuperar" presupuesto: se debe contrastar el intento con la respuesta o facturación del proveedor. Las filas ya persistidas se deduplican por run ID al consultar el journal.

`resumeBudget()` exige actor y razón; no altera límites ni inventa aprobación. Después de que una persona ajuste/revise el presupuesto, permite continuar desde la etapa pendiente. Un presupuesto agotado nunca genera `ready_to_publish`.

## Structured Outputs y seguridad

Se utiliza el SDK oficial `openai@7.43.0`, `responses.create()`, `text.format` con JSON Schema strict, `max_output_tokens`, `store:false`, `truncation:disabled`, sin herramientas y sin retries internos. Ver [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

OpenAI exige objetos cerrados y todos los campos requeridos; los schemas originales son más flexibles. `structured-output.ts` usa un codec de transporte: opcionales con null y lista `__omitted`, extensiones/diccionarios con entradas key/value_json, valores JSON abiertos con json_value. Se conservan distinciones entre null y ausencia y se rechaza omitir campos requeridos o sobreescribir propiedades. Nueve pruebas de round-trip validan que los outputs originales se recuperan sin pérdida; el resultado decodificado debe pasar Ajv y el validador Python original.

No se ofrece tool de investigación, publicación, aprobación ni render externo. El endpoint SDK está fijado a OpenAI oficial y el logging del SDK está apagado. Errores guardados contienen categoría/HTTP status, sin body, headers ni API key. La redacción de secretos distingue métricas como `inputTokens` de credenciales como `access_token`.

El gate determinístico comprueba datos verificables antes de QA IA. El LLM juzga lenguaje, coherencia, originalidad y narrativa de lo disponible. Sin media real no se declara inspección de píxeles ni QA visual completo. Aprobación/publicación siguen bloqueadas cuando faltan assets o validaciones, incluso si el modelo dice que está listo.

## Alcance actual

Una instancia local / workspace editorial serializado. Para un deployment con múltiples hosts, el journal debe trasladarse a una reserva transaccional compartida y reconciliable en PostgreSQL antes de habilitar workers distribuidos. No hay servidor público ni autenticación multiusuario: el actor CLI se declara localmente. No hay publicación real, fetching, rendering externo ni autoaprobación. El modelo no determina esas capacidades.
