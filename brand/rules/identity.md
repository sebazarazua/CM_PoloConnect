# Polo Connect — dirección inicial v1

Fuente prioritaria: los dos archivos aportados por el propietario. Originales sin modificar, con hashes y dimensiones en `brand/assets/manifest.json`. La paleta procede del análisis de sus píxeles, documentado en `brand/generated/palette-analysis.json`. Los neutros, superficies y estados son decisiones editoriales iniciales; no se presentan como un manual histórico oficial.

La identidad combina medios deportivos, edición y tecnología: jerarquía firme, datos inmediatamente legibles, fotografía auténtica y una firma de marca moderada. La composición no tiene que ser siempre un fondo azul. Alternar superficies claras, navy, foto contenida, datos y titulares según el trabajo editorial.

Los arcos parciales y líneas de cinco píxeles son dispositivos abstractos de trayectoria/conexión. No son trazados del jinete, clipart ni una repetición ornamental del isotipo. La tipografía, el espaciado de ocho píxeles y la estructura de información también deben sostener el reconocimiento.

## Marca

- Usar el isotipo normalizado de la app como firma principal, con transparencia y variante adecuada al fondo.
- El horizontal es referencia de paleta, branding y lenguaje visual. No se inserta como sticker raster en las piezas.
- Los originales se preservan. El pack de producción elimina el backing de la app y normaliza colores sin redibujar ni reinterpretar al jinete/anillo.
- Exports en 64/128/256/512/1024px; el origen sigue siendo 200px y los mayores son remuestreados. El manifiesto no los presenta como vector nativo.
- Mantener proporción 1:1 y zona de exclusión. Sólo un mark por pieza.
- Producción permite gradientes azules, highlights celestes y glow de superficie suave y acotado; evitar contornos luminosos, gaming y efectos épicos.

## Tipografía propuesta

Barlow Condensed Semibold/Bold para score y display; Barlow Regular/Semibold para lectura, labels y metadatos. Comparten familia, admiten español y números, y separan titulares compactos de texto normal sin convertir el contenido en gaming. La recomendación se fija **provisionalmente para el renderer**, pendiente de decisión editorial del propietario. No identifica ni sustituye la tipografía del wordmark.

Fuentes originales locales sin cambios, licencias SIL OFL 1.1 incluidas. Fuentes: [Barlow](https://github.com/google/fonts/tree/main/ofl/barlow), [Barlow Condensed](https://github.com/google/fonts/tree/main/ofl/barlowcondensed). No hay llamadas a Google Fonts durante el render.

## Intensidad y variación

`subtle`: fotografía/dato domina, firma menor y sin arcos. `standard`: equilibrio con borde/acento. `strong`: mayor acento y dispositivo gráfico, para contenido que lo justifique. El tamaño del logo no es la única diferencia. Las familias varían la estructura de lectura: fotografía con banda, tabla de resultado, dos columnas, matchup, agenda, titular, quote, estadística, comparación y contexto.

La variante debe elegirse por assets, importancia, superficie, sponsor y composiciones recientes. Una cuenta benchmark nunca define un formato ni una familia. El contexto para social-designer incluye un contrato acotado de decisiones; el LLM no escribe HTML.
