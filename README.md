# LiVa — zapping de transmisiones en vivo

**Build objetivo:** 4.2.1-LIVE-ARGENTINA

LiVa es un producto experimental de descubrimiento de transmisiones en vivo de YouTube y Twitch, con zapping vertical y autoplay silenciado del reproductor oficial visible. Mantiene tres categorías independientes: En vivo (catálogo verificado), Pluto (enlace estático al servicio oficial, sin llamada al Worker) y Grabados (Shorta, manual y externo).

**Estado de release:** HOLD mientras se verifican condiciones de proveedores y reproducción audiovisual real. Una URL pública o embebible no equivale a autorización para retransmitir.

## Stack y desarrollo

- Cloudflare Workers + JavaScript ESM + esbuild; frontend sin React ni CSS remoto.
- CSS local, CSP con SHA-256 del único script inline y orígenes de frames acotados.
- Herramientas de desarrollo: Node.js 22+, Wrangler y Playwright.

```sh
npm ci
npm run build
npm run dev
```

Secretos necesarios para proveedores reales, configurados fuera de Git:

- `YOUTUBE_API_KEY`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`

No pegar tokens en el código, en `wrangler.toml` ni en logs.

## Reproductores y derechos

- Un único iframe **activo y visible**; el anterior se desmonta al cambiar de canal o pestaña.
- Sin precarga de reproducción ni capas que bloqueen controles oficiales.
- Player de YouTube con controles, teclado, branding y fullscreen nativos.
- Twitch recibe un `parent` calculado según el dominio real. Requiere 400 × 300 px; en pantallas menores aparece un enlace al canal oficial.
- Los enlaces a la plataforma de origen están siempre visibles como salida ante errores del embed.
- **Shorta sólo está en la pestaña Grabados**: el usuario debe abrir manualmente el enlace oficial a YouTube. No se carga un iframe, ni se consulta ninguna API ni se reproduce video en segundo plano en esta pestaña.
- Pluto Hub es un directorio al sitio oficial; **no** usa manifiestos HLS directos mientras no exista autorización documentada.
- No se insertan canales regionales con IDs ficticios.

La pantalla de LiVa es vertical, pero el reproductor no se recorta para ocultar controles o elementos propios del proveedor.

## Experiencia móvil

- Por defecto la **pantalla completa usa composición vertical**; el reproductor oficial mantiene su proporción 16:9 y sus controles. Las miniaturas permiten ambientar el espacio vertical sin tocar el video.
- El botón `16:9` expande visualmente el reproductor original y permite regresar a la vista vertical, **sin recargar el iframe**, detener el video ni consultar APIs.
- El desplazamiento tipo TikTok se realiza por las zonas libres **fuera** del reproductor. Los controles del iframe pertenecen al proveedor y no se cubren ni se interceptan. Botones anterior/siguiente son un acceso alternativo.
- Se prueban viewports móviles de 320 × 568, 320 × 720, 390 × 844, 430 × 932 y landscape 568 × 320. En pantallas cortas los controles se compactan sin tapar el reproductor.
- Botones principales tienen objetivos táctiles de al menos 44 px; se respetan las zonas seguras y el zoom del navegador.
- El contenido de video es servido directamente por YouTube o Twitch, nunca a través del Worker. Autoplay silenciado es solicitado, no garantizado por políticas de navegador o por el proveedor. Twitch en pantallas más angostas que su mínimo soportado deriva a un enlace oficial.


## Fuentes, presupuesto y caché

- Twitch: una consulta Helix exclusivamente para martinciriook, coscu y momo cuando están emitiendo; valida user_login y type=live antes de mostrarlos. Token OAuth compartido por isolate, POST form-encoded, renovación singleflight y máximo un reintento ante 401. El catálogo compartido se actualiza cada 15 minutos; cada stream incluye verified_at para mostrar la última verificación de la fuente.
- YouTube: una búsqueda search.list por ciclo con términos OR combinados, más una llamada videos.list de verificación en lote. Sólo pasan los videos cuyo snippet.channelId coincide con el registro verificado de OLGA, LUZU TV, BLENDER, TN y Crónica TV, que son públicos, embebibles y efectivamente activos. Ambas llamadas comparten timeout de 8 segundos. Caché por isolate de 60 minutos para proteger la cuota predeterminada de 100 búsquedas diarias; la marca verified_at permite identificar datos antiguos. Un nuevo directo de YouTube puede tardar hasta una hora en aparecer.
- Catálogo común /api/streams: clave interna versionada __liva/catalogue/argentina-verified-v1 para no heredar emisiones extranjeras de cachés anteriores; caches.default conserva el catálogo durante 15 minutos. Workers Caching puede responder durante 5 minutos antes de ejecutar el Worker. La respuesta pública no contiene geolocalización individual (Cache-Control: public, max-age=300).
- El feed admite únicamente YouTube LIVE de **cinco canales con ID identificado** y Twitch LIVE de **tres nombres de usuario curados**. No se incluyen canales extranjeros, coincidencias de nombres no verificadas, videos grabados ni shuffle. Si no encuentra directos verificados, presenta enlaces manuales a los canales oficiales, sin marcarlos como LIVE ni generar llamadas adicionales.
- Grabados/Shorta: enlace manual declarado públicamente por el editor de Shorta, sin `channels.list` ni `playlistItems.list` y sin llamadas al backend al entrar en la pestaña.

**Sin Workers KV:** no hay bindings KV ni lecturas/escrituras KV, D1 o Durable Objects. El cliente solicita el feed al iniciar y no repite la consulta en cada swipe. Workers Caching mantiene la respuesta pública durante 5 minutos; Cache API regional conserva el catálogo 15 minutos. La búsqueda de YouTube tiene caché por isolate de 60 minutos para proteger su cuota. El reproductor visible solicita autoplay silenciado y reproduce directamente desde YouTube/Twitch, nunca a través del Worker. Al ocultar la pestaña se desmonta el iframe.

**Límite importante:** la caché `caches.default` de Cloudflare es local a cada datacenter. `Workers Caching` puede reducir ejecuciones del Worker, pero aún no está confirmado en producción y tampoco fija un techo global absoluto para las llamadas a YouTube. Esto reduce duplicaciones pero **no impone un límite mundial de consultas**. La documentación de Google (2026-10-08) señala 100 llamadas diarias predeterminadas a `search.list`, sujetas al proyecto y cambios futuros. Para un despliegue a escala hace falta coordinación global (por ejemplo, ingesta programada y almacenamiento compartido) con coste y permisos evaluados antes de implementarla.

Fuentes:
- https://developers.google.com/youtube/v3/determine_quota_cost
- https://developers.google.com/youtube/v3/getting-started
- https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/
- https://dev.twitch.tv/docs/embed/
- https://developers.cloudflare.com/workers/runtime-apis/cache/
- https://developers.cloudflare.com/workers/cache/configuration/

## Rutas

- `GET /` — interfaz.
- `GET /api/streams` — catálogo público común, sin datos individuales del visitante.
- `GET /api/health` — estado básico del Worker.

## Protección ante errores

- Sin consultas adicionales al Worker durante los swipes, sin polling, sin KV/D1/DO.
- El feed se obtiene sólo mediante GET canónico; métodos extraños reciben 405 y parámetros arbitrarios reciben 308.
- La escritura a caché se espera antes de liberar el bloqueo single-flight del catálogo, evitando solicitudes duplicadas en esa ventana.
- Si el catálogo es viejo, la interfaz informa su antigüedad y advierte que el directo puede haber terminado.
- Los estados de catálogo vacío y caída de proveedor muestran retry manual, enlaces a las páginas de los cinco canales de YouTube sin estado LIVE inferido, y eliminan iframes anteriores. Los reintentos consecutivos se agrupan con un guard; la solicitud inicial del feed tiene un timeout de 10 s.
- El catálogo se conserva 15 minutos tanto si hay directos como si está vacío; esto limita consultas repetidas a Twitch. La búsqueda de YouTube permanece cacheada por isolate hasta 60 minutos para proteger la cuota, por lo que la detección de nuevos directos no es instantánea.
- Las miniaturas de proveedores permitidos se representan como imágenes `loading=lazy` y `decoding=async`, no como fondos descargados masivamente.
- Al recargar el catálogo se desconectan los observadores de scroll previos y se restaura el primer canal visible, evitando reproducciones fuera de pantalla.
- Si el usuario entra a Grabados mientras el feed sigue cargando, la respuesta tardía no puede iniciar video oculto. El feed descarta material grabado aunque venga de una respuesta cacheada antigua.
- Los reproductores utilizan video directo del proveedor, no pasan por el Worker. El autoplay puede ser bloqueado por el navegador; el reproductor oficial conserva controles y enlace original.

## Pruebas y release

```sh
npm run test:unit
npm run test:e2e
npm run build
npx wrangler deploy --dry-run
npm audit --audit-level=low
```

Los E2E utilizan metadatos simulados y **bloquean todo reproductor externo**. Validan navegación, tamaño, lifecycle de iframe, CSP, enlaces y seguridad del DOM, pero no verifican decodificación de audio/video, anuncios, restricciones contractuales reales ni compatibilidad iOS/Safari/Firefox.

GitHub Actions (PR/main) ejecuta test unitario, E2E, build y dry-run con permisos `contents: read`. Ninguna verificación publica automáticamente en Cloudflare.

### Gates abiertos

1. Derechos y condiciones específicas de YouTube, Twitch, Pluto, Shorta y de cada titular.
2. Pruebas audiovisuales reales en dispositivos autorizados y errores reales de plataforma.
3. Cuota YouTube global: los límites actuales son por proyecto; cachés por POP no garantizan máximo de llamadas entre datacenters. Necesita control centralizado o presupuesto externo comprobado antes de escalar.
4. Certificar el SHA exacto desplegado, proteger `main`, habilitar branch checks y ensayar rollback.
5. Confirmar titularidad antes de decidir LICENSE. Licencia del código y derechos audiovisuales son diferentes.

**Estado de release: HOLD para certificación completa.** Un deploy de parche técnico no equivale a una certificación de derechos ni a una prueba de reproducción audiovisual real.
