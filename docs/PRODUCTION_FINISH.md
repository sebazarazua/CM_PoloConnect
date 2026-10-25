# Polo Connect — acabado de producción v2

La firma principal es ahora el isotipo de la app, normalizado y transparente. El horizontal se conserva como referencia de identidad/paleta; no se inserta en las piezas. Los originales siguen intactos y vinculados por SHA-256.

## Pack de marca

`brand/assets/production/` contiene siete variantes: full-color, on-light, on-dark, mono-white, mono-navy, high-contrast-dark y high-contrast-light. Cada una se exporta como PNG RGBA en 64, 128, 256, 512 y 1024px: 35 archivos. El renderer selecciona automáticamente on-dark/on-light según el tema.

La normalización elimina el backing blanco/redondeado de la app mediante una máscara alineada al raster original y descontaminación del matte; separa los colores del jinete y del anillo sin generar ni redibujar el símbolo. Todas las variantes comparten la misma máscara y proporción. La limpieza elimina ruido aislado de compresión. El manifiesto conserva el hash de origen, método y hashes de exportación.

La fuente aportada mide 200×200: los exports grandes son remuestreados, no un supuesto master vectorial ni detalle nuevo inventado. Son adecuados como firma a los tamaños de uso social actuales. Un vector oficial sería la fuente preferida para aplicaciones que necesiten más detalle.

## Modos

```powershell
npm.cmd run cm:render-demo
npm.cmd run cm:render-demo -- --mode production
npm.cmd run cm:render-demo -- --mode study
npm.cmd run cm:gallery
```

Producción es el default y exporta en `outputs/production-v2/`. Study conserva el baseline de prototipo, con el nuevo isotipo, en `outputs/design-study/`. El modo también puede indicarse al renderizar un spec o input propio con `--mode`.

`RenderSpec.mode` distingue estudio/producción. `RenderSpec.finish` acepta controles enteros de 0 a 3:

| Control | Función |
|---|---|
| `depth_level` | Capas de superficie, sombras moderadas y foco de luz |
| `accent_intensity` | Presencia de celeste y capas de acento |
| `graphic_density` | Retícula fina, marcas y líneas secundarias |
| `brand_energy` | Inclinación y presencia de los planos azules |
| `background_complexity` | Cantidad de capas de fondo |

Baselines en `brand/tokens/finish.json`: producción 2/3/2/2/2; estudio 0/1/0/0/0. El schema cierra estos parámetros: no admite CSS, efectos arbitrarios ni valores fuera de rango. Social-designer dispone de `render_mode` y `render_finish` como extensiones estructuradas compatibles con su contrato original.

## Acabado y superficies

- Feed: dos filas de resultado con panel principal, score celeste, jerarquía de nombres y contexto inferior.
- Story: título de etapa, asociación horizontal de equipos y score central, con márgenes propios para UI.
- Play/Reel: titular de equipo, rival y franja de score con señal de reproducción; datos críticos dentro de la zona central de crop.

La familia comparte símbolo, tipografía, paleta y microdetalles. Se diferencian el orden de lectura, la distribución y las proporciones. Los fondos combinan azules, planos diagonales, gradientes controlados, retícula fina y focos de luz suaves. No se generan escenarios deportivos ni se agregan humo, fuego, neón gaming o efectos épicos.

Los ejemplos ficticios conservan una etiqueta pequeña de demo; producción elimina los rótulos internos “estudio/placeholder” de las placas de datos. Un layout de producción no concede aprobación ni convierte datos ficticios en hechos reales.

## Verificación y gobernanza

Se conservan derechos, ledger factual, contraste, overflow, safe areas, versionado y aprobación humana. El QA valida la proporción del asset normalizado realmente usado. Los tests verifican alpha, geometría compartida, variantes mono, modos, controles, composiciones y caché. El caché incluye marca, spec, CSS y política de QA; cambiar el acabado invalida renders anteriores.

El renderer continúa determinístico y local, sin llamadas LLM por ajustes visuales. Los presupuestos, progressive disclosure, usage y flags de publicación no se alteran. No hay publicación ni autoaprobación.
