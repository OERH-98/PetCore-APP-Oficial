/* ==========================================================================
   services/fondo_cache_service.js
   Guarda en el dispositivo (Cache Storage) la imagen institucional de fondo
   para que NO se vuelva a descargar en cada página/arranque de la app. La
   descarga vive aquí (y no en utils) porque es un fetch.

   - Primera vez: se devuelve la URL remota (se ve ya) y en segundo plano se
     descarga y se guarda.
   - Siguientes veces: se sirve desde el almacenamiento local (blob:), sin red.
   - Si el admin cambia la imagen, la URL cambia: se guarda la nueva y se
     borran las anteriores.
   Todo falla en silencio hacia la URL remota (sin Cache API, sin CORS, etc.).
   ========================================================================== */
const NOMBRE_CACHE = "pc-fondo-institucional-v1";

let urlObjetoActual = null;

async function guardarEnSegundoPlano(cache, url) {
  try {
    const respuesta = await fetch(url, { mode: "cors" });
    if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
    // Solo se conserva la imagen vigente
    const claves = await cache.keys();
    await Promise.all(claves.filter(function (k) { return k.url !== url; }).map(function (k) { return cache.delete(k); }));
    await cache.put(url, respuesta);
    console.log("[fondo] Imagen institucional guardada en el dispositivo");
  } catch (error) {
    // Sin CORS o sin red: se seguirá usando la URL remota (la caché HTTP normal del WebView ayuda igual)
    console.warn("[fondo] No se pudo guardar la imagen localmente:", error);
  }
}

/** Devuelve el `src` a usar para la imagen: blob local si ya está guardada, o la URL remota. */
export async function obtenerSrcImagenCacheada(url) {
  if (!url) return url;
  try {
    if (!("caches" in window)) return url;
    const cache = await caches.open(NOMBRE_CACHE);
    const guardada = await cache.match(url);
    if (guardada) {
      const blob = await guardada.blob();
      if (urlObjetoActual) URL.revokeObjectURL(urlObjetoActual);
      urlObjetoActual = URL.createObjectURL(blob);
      return urlObjetoActual;
    }
    guardarEnSegundoPlano(cache, url);
    return url;
  } catch (error) {
    console.warn("[fondo] Cache Storage no disponible:", error);
    return url;
  }
}
