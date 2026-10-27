# Instagram: publicación manual de imagen, versión funcional 1

Esta guía describe el flujo manual de Instagram. `cm:demo`, `cm:full-demo`, `cm:publish:mock`, los tests y `verify` siguen usando fixtures. Tener un token no habilita publicaciones. La nueva automatización agrega una autorización por política sobre el mismo publisher y se documenta por separado en [AUTOMATION.md](AUTOMATION.md); sus defaults son supervised/dry-run y publicación desactivada.

## Preparación en Meta

Redirect URI local exacto, sin barra al final:

```text
https://localhost:4318/integrations/instagram/callback
```

1. En Meta for Developers, crear/usar una app comercial y agregar el producto **Instagram**. Seleccionar **API setup with Instagram login** / **Instagram business login**.
2. Copiar **Instagram App ID** y **Instagram App Secret** de esa sección. No usar el identificador de Facebook que aparece arriba del Dashboard.
3. En **Set up Instagram business login → Business login settings → OAuth Redirect URIs**, pegar exactamente el URI anterior. Comprobar el valor guardado: Meta puede agregar una barra final. El valor guardado y `INSTAGRAM_REDIRECT_URI` deben coincidir.
4. Agregar la cuenta profesional de Polo Connect como cuenta de prueba/rol de la app y aceptar la invitación desde Instagram cuando corresponda. El flujo usa una cuenta Business o Creator; no requiere una Facebook Page.
5. Solicitar solamente `instagram_business_basic` y `instagram_business_content_publish`. Para cuentas externas a los roles de la app, tramitar el acceso avanzado y la revisión/verificación que solicite Meta. Completar nombre, correo, política de privacidad e instrucciones/URL de eliminación de datos válidas cuando el Dashboard lo exija; no inventar URLs para guardar el formulario.
6. Configurar la versión Graph soportada por la app. Las páginas oficiales consultadas el 25-10-2026 muestran **v26.0**; `.env.example` usa ese valor. El proveedor exige configuración y no tiene una versión fija de respaldo.

El servidor de desarrollo usa HTTPS y escucha sólo en `127.0.0.1:4318`. `cm:instagram:connect` genera un certificado local de 30 días usando OpenSSL (en Windows se detecta el incluido con Git). Abrir el enlace de configuración de un solo uso que imprime el comando y aceptar el certificado de desarrollo en ese navegador antes de iniciar OAuth. No se agrega una CA al sistema automáticamente. Se pueden proporcionar certificados confiables mediante `INSTAGRAM_TLS_KEY_FILE` y `INSTAGRAM_TLS_CERT_FILE`.

El URI anterior es la configuración local implementada; no constituye una comprobación de aceptación de tu app por Meta. Si el Dashboard exige un dominio público o rechaza localhost, usar un túnel HTTPS propio hacia `http://127.0.0.1:4318`, configurar `INSTAGRAM_PROXY_MODE=true` y `INSTAGRAM_REDIRECT_URI=https://TU_DOMINIO/integrations/instagram/callback`. Registrar ese mismo URI exacto en Meta. `cm:instagram:status` imprime siempre el URI efectivo. El servidor también protege la configuración detrás del túnel con un enlace inicial de un solo uso, sesión de navegador y state. El callback no es un webhook; esta iteración no solicita permisos de mensajes ni suscripciones a webhooks.

## Configuración local

Copiar `.env.example` a `.env` sólo si todavía no existe; preservar cualquier configuración existente. `.env`, `work/` y `.local/` están ignorados por Git. Completar:

```dotenv
INSTAGRAM_CLIENT_ID=ID_DE_INSTAGRAM
INSTAGRAM_CLIENT_SECRET=SECRETO_DE_INSTAGRAM
INSTAGRAM_REDIRECT_URI=https://localhost:4318/integrations/instagram/callback
INSTAGRAM_API_VERSION=v26.0
ENABLE_REAL_PUBLISHING=false

S3_BUCKET=TU_BUCKET_PRIVADO
S3_REGION=REGION_DEL_BUCKET
S3_MEDIA_PREFIX=polo-connect/instagram/
S3_MEDIA_URL_TTL_SECONDS=86400
S3_MEDIA_RETENTION_DAYS=7
```

AWS usa la cadena de credenciales del SDK oficial, incluidos roles/perfiles o `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y, si corresponde, `AWS_SESSION_TOKEN`. Para S3 compatible: `S3_ENDPOINT=https://...` y opcionalmente `S3_FORCE_PATH_STYLE=true`. El permiso IAM debe limitar `s3:PutObject`, `s3:GetObject` y `s3:DeleteObject` al prefijo elegido. Mantener el bucket privado y el bloqueo de acceso público; el proveedor no aplica ACL pública. No hay configuración S3 previa en esta base para reutilizar.

Para generar y revisar con IA, completar también la configuración OpenAI existente: `ENABLE_REAL_AI=true`, `OPENAI_API_KEY`, modelos y precios en `config/pricing.json`, respetando los presupuestos existentes. Esta copia del repositorio contiene OpenAI, Callback y Fixture; no se encontró un adapter Gemini que migrar o modificar.

Después de OAuth, no es necesario copiar tokens a `.env`. Como alternativa técnica se aceptan `INSTAGRAM_USER_ID` (el **user_id profesional**, no el id de alcance de app), `INSTAGRAM_ACCESS_TOKEN` y `INSTAGRAM_TOKEN_EXPIRES_AT`. Si falta una expiración verificable, el estado lo muestra sin estimarla; se valida el token contra Meta antes de publicar. La revocación/desconexión guarda una marca que impide volver a usar por accidente un token que permanezca en el entorno.

Si se usa PostgreSQL, mantener `REPOSITORY=postgres`, `DATABASE_URL` y ejecutar `npm.cmd run db:migrate`. La migración aditiva agrega campos/index de Instagram a `Publication`; la clave de idempotencia única existente se conserva.

## Flujo habitual

```powershell
npm.cmd run cm:instagram:connect
# Abrir el enlace impreso, iniciar sesión y dejar que vuelva al callback. Ctrl+C cierra el servidor.
npm.cmd run cm:instagram:status
npm.cmd run cm:demo-real
```

`cm:demo-real` usa el repositorio editorial habitual, renderer local y los executors/budgets existentes. Prepara un resultado ficticio identificado, con icono propio y sin una fotografía inventada. El caption comienza con **PRUEBA TÉCNICA · Resultado ficticio de demostración**. Se detiene antes de aprobación/publicación y devuelve ID, archivo final, caption, blockers y hash de aprobación. Si una decisión o el QA falla, corregir ese bloqueo antes de continuar. El Quality Reviewer real recibe los píxeles finales. No se sustituye una revisión IA faltante por un resultado fixture.

Para un contenido existente, `cm:instagram:prepare -- --id CONTENT_ID --actor Seba` vincula cuenta/superficie y revoca aprobaciones anteriores; `cm:demo-real -- --id CONTENT_ID` vuelve a producir/revisar ese contenido con su evento y sus assets existentes. El resultado debe ser `single_image` y contener un solo render de feed. El comando con un ID existente no cambia sus hechos por el resultado demo.

Revisar la imagen, el caption, la cuenta y los derechos; luego usar el **hash real que devolvió el comando**:

```powershell
npm.cmd run cm:inspect -- --id CONTENT_ID
npm.cmd run cm:approve -- --id CONTENT_ID --actor Seba --hash HASH_REVISADO
npm.cmd run cm:instagram:package -- --id CONTENT_ID
```

El último comando construye/inspecciona el paquete inmutable sin subirlo ni publicar. El hash editorial de aprobación y el hash del PublicationPackage tienen funciones distintas: el primero autoriza las versiones; el segundo incluye además cuenta, superficie, derivado JPEG y evidencias de QA para identificar la operación real.

Sólo cuando quieras realizar la publicación, cambiar `ENABLE_REAL_PUBLISHING=true` en `.env` y ejecutar personalmente:

```powershell
npm.cmd run cm:publish-real -- --id CONTENT_ID
npm.cmd run cm:publications
```

El proveedor comprueba identidad/permisos, derechos, QA determinista, revisión IA independiente, versión aprobada, archivo/hash y destino. Convierte PNG a JPEG sRGB sin recorte/cambio de dimensiones, o usa el JPEG original válido. Acepta el subconjunto conservador de feed JPEG ≤8 MiB, ancho 320–1440 y relación 4:5 a 1,91:1. Si el archivo no cumple, solicita nuevo render y aprobación. El JPEG está ligado por hash al PNG aprobado.

El flujo sube a S3 privado, firma un GET por 24 h (ajustado a la expiración de credenciales AWS), comprueba mediante GET que los bytes servidos coincidan, crea contenedor, espera `FINISHED`, registra intención, publica y persiste el media ID. Obtiene el permalink cuando está disponible. No guarda tokens ni URLs firmadas en el registro editorial. Una falla al obtener el permalink no revierte una publicación exitosa.

## Publicación controlada de prueba

```powershell
npm.cmd run cm:instagram:test-publish -- --actor Seba
```

Requiere flag real, cuenta, hosting y configuración IA válidos. Genera el demo técnico, muestra imagen/caption/hash/cuenta y solicita escribir `PUBLICAR_PRUEBA:ACCOUNT_ID` en una terminal interactiva. Esa confirmación autoriza la imagen/caption actuales y la publicación de prueba. Para una prueba ya preparada, acepta `--id CONTENT_ID`. Para una ejecución manual no interactiva, acepta `--confirm-test PUBLICAR_PRUEBA:ACCOUNT_ID`. Nunca se invoca desde `verify` ni tests. Para revisar la imagen con más tiempo, usar primero `cm:demo-real` y después la prueba con `--id`.

Una inspección offline del renderer se puede hacer con `cm:demo-real -- --fixture --file .local/mi-preview.json`. No gasta IA, no publica, usa cuenta ficticia si falta conexión y su QA **no habilita publicación real**.

## Reintentos y reconciliación

La reserva se persiste antes de efectos externos. El journal de publicación vive en `ContentItem.publications`, tanto con FileRepository como con Prisma. Se guardan paquete, proveedor, cuenta, asset/caption version, contenedor, media ID, timestamps, permalink, errores normalizados y fases. La clave incluye contentId, hash del paquete real, plataforma y cuenta. La misma versión publicada devuelve el recibo existente, incluso después de reiniciar; renovar la aprobación/QA no vuelve a publicar el mismo payload.

Un lease de 15 minutos impide dos procesos activos sobre el mismo intento. Los errores recuperables previos a publicar permiten una nueva invocación manual; un timeout de procesamiento reutiliza el contenedor. Token expirado o permiso faltante exige corregir la conexión antes de reintentar. Un contenedor `ERROR`/`EXPIRED` es un bloqueo terminal de ese intento; corregir/regenerar el contenido y su aprobación. No hay retries automáticos de `media_publish`.

Si la respuesta de publicación se pierde, queda `unknown`/`reconciliation_required`. Se bloquean intentos nuevos del mismo contenido/cuenta, aun si después cambia su aprobación. Primero verificar visualmente en Instagram y consultar `cm:publications`. Para un post confirmado:

```powershell
npm.cmd run cm:instagram:reconcile -- --id CONTENT_ID --publication-id PUBLICATION_ID --media-id IG_MEDIA_ID --actor Seba
```

La reconciliación exige contenedor `PUBLISHED`, pertenencia del media ID a los últimos 100 medios de la cuenta, caption exacto y timestamp compatible; además registra al humano que verificó la imagen. No publica. Si Meta no permite confirmar el resultado, permanece bloqueado para evitar duplicados. No borrar/resetear registros para “reintentar”. Con FileRepository, un corte exactamente dentro de una transacción puede dejar el lock de archivo: comprobar que el proceso terminó y conservar el archivo editorial antes de recuperar el lock; el sistema falla cerrado en vez de duplicar un post. No copiar/resetear repositorios para publicar la misma versión.

## Credenciales, retención y alcance

El vault cifra tokens con AES-256-GCM y conserva expiración/permisos. Clave y ciphertext quedan en `.local/instagram`, fuera de snapshots editoriales; Windows restringe ACL al usuario que ejecuta el comando. En otros sistemas usa modo 0700/0600. Como alternativa se acepta una clave externa de 32 bytes base64 en `INSTAGRAM_TOKEN_ENCRYPTION_KEY`. Respaldar el vault y la clave con controles equivalentes; perder la clave exige reconectar. Es un servidor local de un usuario, no autenticación multiusuario para internet.

`cm:instagram:refresh` renueva explícitamente tokens largos de al menos 24 h antes de su vencimiento. `cm:instagram:disconnect` revoca acceso y elimina la conexión local; si la revocación falla se conserva la credencial para poder reintentar. La ruta POST de desconexión en el servidor exige sesión y CSRF del mismo origen. Status nunca muestra credenciales completas.

`cm:instagram:cleanup` elimina sólo objetos registrados bajo el prefijo administrado cuya retención ya venció, conservando intentos ambiguos. Alternativamente, configurar una regla Lifecycle del bucket para ese prefijo según la política acordada; la herramienta no modifica políticas del bucket. No hay limpieza programada en esta versión.

El provider tiene flujo REELS y polling acotado (cinco consultas, intervalo de un minuto), testeado con HTTP ficticio. El pipeline de video existente sólo produce referencias mock; **no se afirma tener render/publicación MP4 end-to-end**. Carousel y Story tienen contratos y creación de contenedores testeada; el servicio manual productivo limita esta versión a imagen feed. No se implementó scheduler, investigación adicional ni cambios en las nueve Skills.

## Fuentes oficiales revisadas el 25-10-2026

El transporte Meta real se bloquea además cuando corre Vitest; las pruebas deben inyectar HTTP ficticio.

- [Business Login for Instagram: scopes, code exchange, tokens, refresh y coincidencia de redirect URI](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/).
- [Get Started: perfil profesional, user_id y formatos de respuesta](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started).
- [Content Publishing: host Instagram, permisos, JPEG, contenedores y estados](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/).
- [Referencia de media: tamaño, relación, ancho, espacio de color y parámetros](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media).
- [Configuración de la app y Business Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/create-a-meta-app-with-instagram).

La lectura web inicial recibió 429; se verificó el contenido oficial después mediante HTTPS directo. No se usaron límites de blogs como contrato de producción. Meta determina disponibilidad final de permisos/cuenta y cuota: sus páginas tienen cifras distintas según sección/superficie, por lo que la implementación no presume una cuota fija ni intenta eludir errores de límite.
