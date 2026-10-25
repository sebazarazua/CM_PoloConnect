# Polo Connect — sistema visual y renderer real

25 de octubre de 2026. Implementado sobre la raíz Git existente, sin crear commits ni conectar redes sociales.

## Entrega visible

`outputs/render-demo/index.html` permite comparar 36 composiciones: cuatro salidas principales y 32 variantes. Hay filtros por superficie y tema, PNG, JPG y manifiesto por pieza. `preview.png` compara las adaptaciones; `gallery-screenshot.png` muestra la galería; `gallery-qa.json` contiene la comprobación de archivos y UI. El directorio se regenera con `npm.cmd run cm:gallery` y permanece ignorado por Git.

| Archivo principal | Dimensiones |
|---|---|
| `feed-result.png` / `.jpg` | 1080×1350 |
| `story-result.png` / `.jpg` | 1080×1920 |
| `reel-cover.png` / `.jpg` | 1080×1920 |
| `square-result.png` / `.jpg` | 1080×1080 |

El demo representa Team Azul 12 — Team Blanco 10, FINAL, Torneo Demo. Los datos son ficticios. No se proporcionó fotografía deportiva: las familias fotográficas usan un placeholder abstracto identificado, sin caballos, jugadores ni escenarios sintetizados.

## Marca y originales

Se copiaron y registraron intactos los dos originales aportados. El horizontal mide 628×231; el icono 200×200. Metadata: `source=provided_by_owner`, `rights=owned`, `role=official_brand_reference`, hash SHA-256 y `altered=false`. Se comprueba integridad al cargar la marca. No se redibujó el jinete, no se reescribió el wordmark y no se generaron variantes artificiales.

Paleta principal derivada del muestreo de píxeles opacos y agrupación RGB reproducible:

| Token | Valor |
|---|---|
| `brand.navy` | `#070D25` |
| `brand.darkBlue` | `#12223C` |
| `brand.blue` | `#2D5377` |
| `brand.brightBlue` | `#247CE6` |
| `brand.white` | `#FFFFFF` |

También existen superficies claras/oscuras/elevadas, texto, acentos, estado y gradiente navy→blue. Los neutros y el rojo editorial de live/breaking son decisiones propuestas, no colores históricos extraídos. `brand/generated/palette-analysis.json` conserva la evidencia; `brand/tokens/` separa colores, tipografía, espaciado y layout.

Tipografía editorial **provisional**: Barlow Condensed Semibold/Bold para display y números, Barlow Regular/Semibold para información. Favorece jerarquía deportiva, lectura en español y diferenciación entre dato y contexto, sin intentar copiar el wordmark. Se incluyeron TTF originales y licencias SIL OFL 1.1 de [Barlow](https://github.com/google/fonts/tree/main/ofl/barlow) y [Barlow Condensed](https://github.com/google/fonts/tree/main/ofl/barlowcondensed). No hay descargas de fuentes durante la exportación.

El horizontal conserva su fondo raster. El icono conserva su fondo y forma. Se usan contenidos, proporcionados y a tamaños menores que sus dimensiones nativas; no se inventó una versión transparente ni resolución vectorial. Para futuras aplicaciones exigentes conviene aportar esos originales.

## Dirección de arte implementada

32 variantes distribuidas en result (4), fixture (4), news (3), player (3), horse (3), Reel cover (4), Story (5) y carousel (6). Comparten diez estructuras de información: foto/banda, score, minimal, matchup, agenda, headline, quote, stat, comparación y contexto. No son 32 motores independientes ni una cuenta benchmark asignada a cada formato.

Se separan familia, carrier, jerarquía, densidad, tratamiento fotográfico, intensidad de marca y tema. Hay composiciones claras y oscuras; la marca no depende sólo de saturar el fondo de azul. Los dispositivos propios son arcos parciales, líneas, ritmo de datos y espaciado. No hay glow, humo, fuego, partículas, metálicos, 3D, neón ni escenarios falsos.

`social-designer` recibe el contrato de decisiones en su contexto seleccionado y puede devolver `render_decision` como extensión compatible del schema original. No genera HTML. El fallback determinístico considera calidad/disponibilidad de foto, superficie y familias recientes; una dirección explícita se valida antes de renderizar. Las reglas y propuestas están en `brand/rules/`.

## Renderer y contratos

HTML/CSS con Playwright 1.64.1 y Chromium headless; Sharp 0.35.5 exporta JPG y comprueba raster/dimensiones. No requiere Canva, S3 ni servidor. El browser bloquea red; los recursos se incrustan localmente. El texto se escapa, la CSP no permite scripts en las piezas y no se aceptan SVG/HTML externos como fotografías.

`RenderSpec` es un contrato Ajv cerrado, exportado en `brand/generated/render-spec.schema.json`. Incluye dimensiones, superficie, decisión, contenido, foto/focal/rectángulo protegido, logo, sponsor, interacción reservada, secuencia y procedencia/versionado. Un ledger separado aporta score, nombres, torneo, etapa y texto aprobado. El spec no verifica sus propios hechos.

`LocalDesignRenderer` implementa el provider existente y recibe el mismo evento y revisión de la orquestación. El adaptador automático inicial se especializa en resultados; las demás familias se alimentan por RenderSpec/brief validado. No se infiere un artículo o una estadística a partir de un adjetivo. Story y cover se recomponen con zonas y tamaños propios; no se escala simplemente la placa cuadrada.

La exportación valida archivo, dimensiones, derechos, hashes, fuente, texto dentro de bounds, overflow, colisiones, contraste ≥4.5, proporción de logo, sponsor declarado y safe areas. El crop respeta una región protegida cuando se aporta. Las zonas Story 220/300 y cover 320/320 son márgenes conservadores locales; requieren revalidación en la UI/ruta final de publicación. Los espacios de poll/link son reservas, no stickers funcionales dentro del PNG.

El caché vincula spec, ledger, contenido HTML/CSS, media/fuentes, marca, política QA y versión Chromium. Revalida hashes y dimensiones del raster almacenado. En el segundo recorrido de galería se comprobaron **36/36 hits**. El pipeline usa nombres por evento/spec para conservar versiones. Cambiar bytes de un render revisado invalida la aprobación y bloquea el contenido; un buen score visual no lo elude.

## QA visual y gobernanza

Quality Reviewer recibe los archivos finales de feed, Story y Reel cover como imágenes reales de entrada, con detalle high, IDs, hashes y dimensiones. Se probaron el request del SDK y los bytes PNG contra un transporte fake; los logs/WorkflowRun conservan metadata, nunca el base64 del request. La versión del executor pasó a 2 para invalidar cachés incompatibles del transporte anterior.

El demo entregado usa planning y QA fixture, con **píxeles reales**. No se afirma que un modelo haya inspeccionado visualmente las imágenes: API key ausente y `ENABLE_REAL_AI=false`. Se hicieron comprobaciones visuales locales del asistente y QA geométrico. La evaluación editorial final, autenticidad de una fotografía futura y aprobación humana siguen pendientes.

Con habilitación explícita, el experimento usa el SDK/runner existente, caché persistida en `.local/visual-ai-demo.json`, journal, model routing, budgets, retries y ledger. Una interrupción/fallo escribe el estado y el reporte parcial. Las imágenes se presupuestan antes de llamar: reserva conservadora de bytes+16384 por imagen; el preview declara `imageTokenEstimate:null`, porque el costo visual depende del modelo. Si no entra en FAST, se bloquea para revisar presupuesto: no se omiten imágenes ni QA. No hubo llamadas pagas.

## Verificación

- Nueve Skills y sus 64 tests originales: aprobados; schemas/validadores originales conservados.
- Suite TypeScript: **74/74**, en diez archivos. Incluye 21 tests nuevos de render/QA visual, los tests anteriores de gobernanza y los originales del sistema.
- `npm run verify`: lint, typecheck, tests, build, safety y full demo fixture.
- PostgreSQL temporal: migraciones, pipeline, proyecciones, concurrencia, reconexión y cierre aprobados.
- Matriz visual: 36 archivos únicos comprobados, hashes y dimensiones correctos, QA técnico aprobado.
- Galería en Chromium: filtro Story muestra seis piezas; filtro light diez; cero errores de página.
- Prueba de segunda ejecución del pipeline visual: cuatro Skills iniciales, ninguna ejecución adicional idéntica; transport con tres renders finales comprobado.
- Archivo modificado después de QA: blocker e invalidación de aprobación comprobados.

Durante la implementación se corrigieron desbordes derivados del interlineado, una comprobación de fuente todavía no cargada, el manejo de estado al modificar un PNG y el trabajo redundante del carrusel en caché. No se desactivaron validaciones para conseguir verde.

## Comandos

```powershell
npm.cmd run render:install
npm.cmd run brand:build
npm.cmd run cm:render-demo
npm.cmd run cm:gallery
npm.cmd run cm:render -- --input fixtures/render/result.input.example.json
npm.cmd run test:render
npm.cmd run verify
npm.cmd run test:postgres
```

Para resultado propio, usar el input de ejemplo con datos ya verificados y su procedencia, y agregar una foto local autorizada con source/credit/rights. El comando conserva el original en `assets/approved/`. No hace verificación periodística independiente; no publica. Para revisión remota, configurar key/modelos compatibles con imágenes/precios y revisar el presupuesto antes de `npm.cmd run cm:render-demo -- --real-ai`.

`cm:reference-import` prepara screenshots con hash, tamaño, orientación, paleta y etiquetas de mecanismos del operador. Conserva `editorial_reference_only`; el análisis semántico independiente queda marcado pendiente. No copia diseños ni asigna una cuenta a un formato.

## Límites y siguiente paso

La base técnica y las piezas gráficas son reales. El estándar fotográfico deportivo completo todavía debe evaluarse con material auténtico: faltan fotos autorizadas de polo, y las imágenes de logo son pequeñas y con fondo incluido. Más efectos no solucionan esa ausencia.

El próximo paso útil es incorporar una foto real autorizada, ajustar focal/región protegida y revisar las tres adaptaciones sobre ese material. Después, refinar dirección de arte y aprobar la propuesta tipográfica. No se conectaron Instagram, Meta, Metricool, scraping, analytics real ni almacenamiento externo. No hubo publicación ni autoaprobación.

Manual técnico y ejemplos: `docs/VISUAL_SYSTEM.md`. Evidencia local de ejecución: `.local/verify-visual-final.log`, `postgres-visual-final.log`, `render-tests-final.log`, `gallery-visual-final.log` y `gallery-cache-final.log`.
