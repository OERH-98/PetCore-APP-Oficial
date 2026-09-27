/* ==========================================================================
   PetCore — Portal de Propietarios
   js/services/sesion_service.js
   Verificación de sesión contra el backend -- los fetch/XHR van acá,
   nunca en utils/controllers (mismo criterio que login_service.js con
   loginPropietario/logout).

   Es XHR SÍNCRONO, no fetch: sesion_utils.js necesita devolver la sesión
   ya verificada de forma síncrona (requerirSesion() la siguen llamando
   ~10 controllers como "const sesion = requerirSesion();", sin await),
   así que esa restricción viene de ahí, no de este archivo.
   ========================================================================== */
const API_URL_PROPIETARIOS = "https://petcore-8afada45fabc.herokuapp.com/api/propietarios";

// Mismo truco que fetch_con_credenciales.js, pero para XHR (que no pasa
// por window.fetch): si la página se sirve desde 127.0.0.1 (Live Server)
// en vez de localhost, hay que apuntar el XHR ahí también -- si no,
// "localhost" y "127.0.0.1" son sitios distintos para SameSite y el
// navegador no mandaría la cookie de sesión.
function conMismoHost(url) {
  return url.replace(/^(https?:\/\/)(?:localhost|127\.0\.0\.1)(:(?:8080|8081)\b)/, `$1${window.location.hostname}$2`);
}

// La API envuelve toda respuesta en {success, message, data}: igual que el
// wrapper de fetch() en fetch_con_credenciales.js, pero para XHR.
function desenvolverApiResponse(cuerpo) {
  const esEnvoltorio = cuerpo !== null && typeof cuerpo === "object" && !Array.isArray(cuerpo)
    && typeof cuerpo.success === "boolean" && "message" in cuerpo && "data" in cuerpo
    && Object.keys(cuerpo).length === 3;
  return esEnvoltorio ? cuerpo.data : cuerpo;
}

function xhrSincrono(url, conCredenciales) {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", conMismoHost(url), false);
    xhr.withCredentials = !!conCredenciales;
    xhr.send(null);
    if (xhr.status < 200 || xhr.status >= 300) return null;
    return desenvolverApiResponse(JSON.parse(xhr.responseText));
  } catch (e) {
    console.error("No se pudo verificar la sesión:", e);
    return null;
  }
}

/* sesion_temprana_service.js es un script clásico que cada página carga en
   su <head> (junto a tema_temprano.js). Si el navegador sirve un .html viejo
   desde caché que todavía no lo trae, en vez de tratarlo como "sin sesión"
   (y sacar al propietario al login en bucle) se descarga y ejecuta aquí
   mismo, sincrónicamente: así sigue habiendo UN solo lugar con la URL de /me. */
function asegurarSesionTempranaService() {
  if (window.SesionTempranaService) return true;
  try {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", new URL("./sesion_temprana_service.js", import.meta.url).href, false);
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) {
      (0, eval)(xhr.responseText);
    }
  } catch (e) {
    console.error("No se pudo cargar sesion_temprana_service.js:", e);
  }
  return !!window.SesionTempranaService;
}

/** GET /api/auth/me/propietario -- quién soy, según la cookie httpOnly
 *  "authTokenPropietario". La petición en sí vive en
 *  sesion_temprana_service.js para que módulos y tema compartan un único
 *  resultado por carga de página. */
export function verificarSesionSync() {
  if (!asegurarSesionTempranaService()) return null;
  return window.SesionTempranaService.verificarSesionSync();
}

/** Descarta el resultado memorizado de /me (sesión que cambia sin recargar). */
export function invalidarSesionCache() {
  if (window.SesionTempranaService) window.SesionTempranaService.invalidarSesionCache();
}

/** GET /api/propietarios/{id} -- ficha completa (pro_nombre/pro_apellido/
 *  pro_foto_url), que /me no incluye. */
export function obtenerPropietarioSync(id) {
  return xhrSincrono(`${API_URL_PROPIETARIOS}/${id}`, true);
}
