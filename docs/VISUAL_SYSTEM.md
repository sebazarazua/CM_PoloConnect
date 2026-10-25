# Sistema visual y renderer local

## Dirección

Brand inicial derivado de los dos originales del propietario, conservados byte por byte. Muestreo documentado en `brand/generated/palette-analysis.json`; reglas en `brand/rules/`. Paleta principal: navy `#070D25`, dark blue `#12223C`, blue `#2D5377`, bright blue `#247CE6`, blanco. Tokens semánticos separan superficies, texto, acento y estado. Los estados live/breaking añaden rojo editorial controlado, sin efectos.

Barlow Condensed Semibold/Bold + Barlow Regular/Semibold: **propuesta editorial provisional**, no identificación de la fuente del logo. Se incluyen TTF y licencias OFL de [Google Fonts Barlow](https://github.com/google/fonts/tree/main/ofl/barlow) y [Barlow Condensed](https://github.com/google/fonts/tree/main/ofl/barlowcondensed). No hay descargas durante el render. El wordmark sigue siendo imagen.

Las familias incluyen 32 variantes: cuatro de resultados, cuatro de fixture, tres news, tres player, tres horse, cuatro reel cover, cinco story y seis carousel. Diez estructuras de información compartidas —foto/banda, score, minimal, matchup, agenda, headline, quote, stat, comparación, contexto— permiten mantener un sistema coherente. Las familias no equivalen a 32 motores independientes. Tema, jerarquía, densidad, intensidad y fotografía son decisiones separadas. Se priorizan mecanismos editoriales, no cuentas benchmark.

## Uso inmediato

```powershell
npm.cmd run render:install
npm.cmd run brand:build
npm.cmd run cm:render-demo
npm.cmd run cm:gallery
```

El navegador Chromium headless se instala una vez. El demo usa evento ficticio verificado, el `social-designer` original con executor fixture validado, RenderSpec, renderer local y Quality Reviewer fixture con PNG final adjunto en su contexto. Produce PNG y JPG de feed 1080×1350, Story 1080×1920, Reel cover 1080×1920 y square 1080×1080. La galería añade las 32 variantes y una secuencia de seis slides con continuidad. `outputs/render-demo/index.html` es estático y funciona sin servidor; filtra por superficie/tema.

Cada export tiene `.spec.json` en las piezas principales y `.manifest.json` con spec, QA, hashes y versión de entrada. `report.json` resume el recorrido; `workflow.json` conserva el ledger. Hay un preview conjunto. Todo queda local e ignorado por Git; regenerarlo no cambia fuentes ni aprobaciones.

## Resultado propio + fotografía

Partir de `fixtures/render/result.input.example.json`. Conservar el carácter ficticio del ejemplo. Para un evento real ingresar hechos ya verificados, `verifiedBy`, `source`, `simulated:false` y versión. El renderer no verifica noticias ni transforma un resultado declarado en evidencia independiente.

Agregar al JSON, cuando exista foto autorizada:

```json
{
  "photo": {
    "path": "C:/ruta/foto-autorizada.jpg",
    "rights": "owned",
    "source": "Archivo propio / identificador de toma",
    "credit": "Fotógrafo autorizado",
    "synthetic": false,
    "focal": {"x": 0.5, "y": 0.4}
  }
}
```

```powershell
npm.cmd run cm:render -- --input "C:/ruta/resultado-verificado.json"
```

La foto se copia sin alterar a `assets/approved/` bajo su hash. El planning fixture es explícito y sin costo LLM; una dirección de arte aprobada puede proporcionarse en `decision`. Una imagen de referencia no autoriza uso fotográfico. La inspección visual y aprobación humana siguen pendientes. Se conservan crédito, fuente y derechos en la procedencia.

Para mayor control usar un RenderSpec completo y ledger independiente:

```powershell
npm.cmd run cm:render -- --spec "outputs/render-demo/feed-result.spec.json" --truth "outputs/render-demo/truth.json" --out "outputs/custom-render"
```

RenderSpec se valida con Ajv y un contrato cerrado. `src/render/spec.ts` exporta su schema; `brand/generated/render-spec.schema.json` lo conserva para editores. No hay HTML libre ni campos de efectos. La entrada tipada admite foto/focal/rectángulo protegido, score, quote, estadísticas, schedule, sponsor y secuencia. Las dimensiones admiten tamaños futuros entre 320 y 4096, sujetos a QA.

## Pipeline y QA

`LocalDesignRenderer` implementa el provider existente. Se selecciona explícitamente en el demo visual; los comandos y mocks anteriores permanecen disponibles. El provider recibe el mismo EventRecord y versión que las otras Skills. La conversión automática inicial se especializa en resultados; los demás grupos tienen RenderSpec y renderer, y se alimentan mediante un brief/spec validado. No se infiere un artículo completo desde un headline.

El QA determinístico mide el DOM real después de cargar TTF e imágenes: bounds, scroll, rangos de texto, colisiones, contraste ≥4.5, ratio del logo, safe areas, fuente disponible, dimensiones y derechos. Compara score/versión/tournament/stage con un ledger separado; verifica hash de media y sponsor declarado. El score del PNG se genera a partir de esos mismos campos, sin texto de score libre.

Las guías iniciales de Story reservan 220px arriba y 300px abajo a escala 1080. Reel cover reserva 320/320 y contempla crop central 4:5. Son márgenes conservadores de diseño; no certifican la UI vigente de Instagram. Stickers son espacios reservados, no enlaces/polls funcionales dentro del PNG. Revalidar en la ruta real de publicación.

El motor usa HTML/CSS, [Playwright screenshot](https://playwright.dev/docs/screenshots) y Sharp para JPG/dimensiones. Red bloqueada, CSP sin scripts ni recursos remotos, texto escapado, archivos raster del workspace. Un crop con región protegida que corta al sujeto bloquea; sin anotación no se promete identificación semántica automática.

El caché incluye spec, fuente de verdad, bytes de assets/fuentes/HTML/CSS, política QA, marca y versión de Chromium. Revalida hashes y dimensiones del archivo cacheado. Los archivos de pipeline tienen nombre por evento/spec; una pieza nueva no sobreescribe silenciosamente otra aprobada. Cualquier cambio de los bytes finales invalida la revisión vinculada.

## QA visual con IA y consumo

Con credenciales/modelos/precios ya configurados según README:

```powershell
npm.cmd run cm:render-demo -- --real-ai
```

Usa el executor OpenAI existente y sus presupuestos/journal/retries. Sólo Quality Reviewer recibe los PNG/JPG finales como `input_image`, detalle high; no una descripción pretendiendo ser la imagen. Se comprueban fuente, hash y derechos antes de la llamada. El ledger guarda ruta/hash/dimensiones, nunca el base64 del request. El transporte se probó con SDK fake y bytes PNG reales, sin gasto remoto.

La estimación textual del preview se distingue de `imageInputReservation`: reserva local deliberadamente amplia de bytes por imagen +16384, con `imageTokenEstimate:null` porque la cuenta visual depende del modelo. No es una fórmula de facturación ni una garantía universal de tokenización. Usage API sigue siendo la medición. Si la reserva no entra, el workflow se bloquea; se revisa explícitamente el presupuesto, sin omitir QA o enviar menos imágenes a escondidas. Llamadas con exceso informado también bloquean tras contabilizar uso.

No existe API key configurada en este equipo durante esta iteración. El demo entregado usa fixture de decisiones/QA y render real; **no afirma una revisión remota ejecutada**. El asistente revisa ejemplos visualmente y el propietario conserva la aprobación. La falta de fotografía real y las limitaciones del logo raster se registran como tales.

## Límites y próximos pasos

- Logo horizontal original 628×231 con fondo incluido; icono 200×200. No se inventaron versiones transparentes ni detalle vectorial. Solicitar originales vectoriales/alta resolución para futuras aplicaciones.
- Brand/type propuestos, pendientes de refinamiento editorial. No hay sponsor real ni obligaciones cargadas.
- Placeholders explícitos en demo; faltan fotografías reales para valorar calidad de crop, emoción e integración. No se generaron caballos ni jugadores.
- QA geométrico no sustituye OCR/visión independiente ni evaluación humana de originalidad, autenticidad o dirección de arte.
- Renderer gráfico; no edita Reels ni publica. No Meta, Metricool, scraping, analytics real, Canva obligatorio ni S3.
- Antes de workers concurrentes distribuidos se necesita reservar presupuesto y bloquear exportaciones en almacenamiento transaccional compartido, como ya describe AI_RUNTIME.
