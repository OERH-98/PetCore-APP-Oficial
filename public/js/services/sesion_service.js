/* ==========================================================================
   PetCore — Portal de Propietarios
   js/services/sesion_service.js
   Verificación de sesión contra el backend -- los fetch/XHR van acá,
   nunca en utils/controllers (mismo criterio que login_service.js con
   loginPropietario/logout).

   Cada función existe en dos versiones: *Sync (XHR síncrono, para
   tema_temprano.js, que necesita el pro_id ANTES del primer render) y
   *Async (fetch, para requerirSesion() en sesion_utils.js -- el gate real
   de las páginas protegidas). No son intercambiables: en iOS, el puente
   nativo CapacitorHttp/CapacitorCookies (necesario para que la cookie de
   sesión viaje en peticiones cruzadas a Heroku) solo puede interceptar
   peticiones asíncronas, así que la versión síncrona ahí SIEMPRE devuelve
   "sin sesión" aunque la cookie sea válida.
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

/** Igual que verificarSesionSync(), pero con fetch() en vez de XHR síncrono
 *  -- es la que usa requerirSesion() (el gate real de las páginas
 *  protegidas): en iOS el puente nativo CapacitorHttp/CapacitorCookies solo
 *  puede llevar la cookie de sesión en peticiones asíncronas, un XHR
 *  síncrono lo esquiva y siempre da "sin sesión" ahí aunque la cookie sea
 *  válida. */
export async function verificarSesionAsync() {
  if (!asegurarSesionTempranaService()) return null;
  return window.SesionTempranaService.verificarSesionAsync();
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

/** Igual que obtenerPropietarioSync(), pero con fetch() -- ver
 *  verificarSesionAsync() para el porqué. */
export async function obtenerPropietarioAsync(id) {
  try {
    const resp = await fetch(conMismoHost(`${API_URL_PROPIETARIOS}/${id}`), { credentials: "include" });
    if (!resp.ok) return null;
    return desenvolverApiResponse(await resp.json());
  } catch (e) {
    console.error("No se pudo obtener el propietario (async):", e);
    return null;
  }
}
