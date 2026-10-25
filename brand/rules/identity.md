# Polo Connect — dirección inicial v1

Fuente prioritaria: los dos archivos aportados por el propietario. Originales sin modificar, con hashes y dimensiones en `brand/assets/manifest.json`. La paleta procede del análisis de sus píxeles, documentado en `brand/generated/palette-analysis.json`. Los neutros, superficies y estados son decisiones editoriales iniciales; no se presentan como un manual histórico oficial.

La identidad combina medios deportivos, edición y tecnología: jerarquía firme, datos inmediatamente legibles, fotografía auténtica y una firma de marca moderada. La composición no tiene que ser siempre un fondo azul. Alternar superficies claras, navy, foto contenida, datos y titulares según el trabajo editorial.

Los arcos parciales y líneas de cinco píxeles son dispositivos abstractos de trayectoria/conexión. No son trazados del jinete, clipart ni una repetición ornamental del isotipo. La tipografía, el espaciado de ocho píxeles y la estructura de información también deben sostener el reconocimiento.

## Marca

- Usar un solo logo por pieza; horizontal para espacio ancho, icono para firma compacta/cover.
- Conservar relación de aspecto, colores y píxeles originales. No recomponer ni reescribir el wordmark.
- El horizontal suministrado incluye un fondo raster. Conservarlo como una firma contenida; no simular una versión transparente ni vectorial.
- Evitar ampliar más allá de su resolución nativa: horizontal 628×231, icono 200×200. Estos originales no permiten prometer detalle vectorial en imprenta.
- Zona de exclusión inicial: 24px a escala de 1080. Prominencia por defecto pequeña, sin competir con el resultado.

## Tipografía propuesta

Barlow Condensed Semibold/Bold para score y display; Barlow Regular/Semibold para lectura, labels y metadatos. Comparten familia, admiten español y números, y separan titulares compactos de texto normal sin convertir el contenido en gaming. La recomendación se fija **provisionalmente para el renderer**, pendiente de decisión editorial del propietario. No identifica ni sustituye la tipografía del wordmark.

Fuentes originales locales sin cambios, licencias SIL OFL 1.1 incluidas. Fuentes: [Barlow](https://github.com/google/fonts/tree/main/ofl/barlow), [Barlow Condensed](https://github.com/google/fonts/tree/main/ofl/barlowcondensed). No hay llamadas a Google Fonts durante el render.

## Intensidad y variación

`subtle`: fotografía/dato domina, firma menor y sin arcos. `standard`: equilibrio con borde/acento. `strong`: mayor acento y dispositivo gráfico, para contenido que lo justifique. El tamaño del logo no es la única diferencia. Las familias varían la estructura de lectura: fotografía con banda, tabla de resultado, dos columnas, matchup, agenda, titular, quote, estadística, comparación y contexto.

La variante debe elegirse por assets, importancia, superficie, sponsor y composiciones recientes. Una cuenta benchmark nunca define un formato ni una familia. El contexto para social-designer incluye un contrato acotado de decisiones; el LLM no escribe HTML.
