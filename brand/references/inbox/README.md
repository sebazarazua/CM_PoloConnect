# Referencias visuales

Agregar screenshots propios/autorizados aquí o registrar desde otra carpeta:

```powershell
npm.cmd run cm:reference-import -- --file "C:/ruta/captura.png" --source "Medio / post / fecha" --mechanisms "hierarchy,crop,typography"
```

El importador conserva bytes, registra hash, tamaño, orientación y paleta, deduplica por hash y acepta etiquetas de mecanismos del operador. El análisis visual semántico queda explícitamente pendiente de revisión independiente; los colores no explican por sí solos el diseño.

Tags admitidos: `hierarchy`, `crop`, `typography`, `density`, `score`, `carousel_rhythm`, `photo_treatment`. Nunca cuenta → formato. Rights: `editorial_reference_only`; estos screenshots no son fotografías de producción. Las imágenes quedan ignoradas por Git; el índice registra su procedencia. No hay scraping, copias de layouts ni análisis LLM automático al importar.
