/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/sesion_utils.js
   Ya NO se confía en localStorage para saber quién está logueado -- ahí
   cualquier script de la página podía escribir a mano y fingir ser otro
   propietario. La fuente real es la cookie httpOnly "authTokenPropietario"
   (nombre propio, distinto al "authToken" de empleado -- así ambas sesiones
   conviven en el mismo navegador sin pisarse), que solo el backend puede
   leer/emitir: requerirSesion() la verifica contra
   GET /api/auth/me/propietario en cada carga de página.
   El resultado vive solo en memoria (no en sessionStorage/localStorage) y
   se recalcula en cada carga de página -- la decisión de "hay sesión o no"
   siempre la toma el backend. tema_temprano.js (cosmético: tema/daltonismo,
   no seguridad) necesita el pro_id ANTES del primer render y por eso sigue
   usando su propio XHR síncrono aparte -- ver sesion_temprana_service.js.
   Los fetch/XHR en sí viven en services/sesion_service.js -- este archivo
   solo orquesta (cachea, decide si redirige), igual que el resto de la
   app separa utils/controllers de services.

   ES ASÍNCRONO (requerirSesion()/obtenerSesion() devuelven Promise) a
   propósito: usa las versiones *Async del service (fetch, no XHR
   síncrono) porque en iOS el puente nativo que lleva la cookie de sesión
   entre dominios (CapacitorHttp/CapacitorCookies) solo intercepta
   peticiones asíncronas -- con XHR síncrono, iOS siempre veía "sin sesión"
   aunque la cookie fuera válida y expulsaba al propietario justo después
   de loguearse. Android/desktop no tenían este problema, pero comparten el
   mismo código: no vale la pena mantener dos rutas.
   ========================================================================== */
import { verificarSesionAsync, obtenerPropietarioAsync, invalidarSesionCache } from "../services/sesion_service.js";

/* La sesión (id, nombre, correo, foto) vive SOLO en memoria, durante esta
   carga de página: ya no se copia a sessionStorage ni a localStorage, donde
   cualquiera con DevTools la veía. Cada página la vuelve a pedir al backend
   (que la lee de la cookie httpOnly) con requerirSesion(). */
let sesionEnMemoria = null;

/** Actualiza la sesión en memoria (ej. tras editar el perfil). */
export function guardarSesion(datos) {
  sesionEnMemoria = datos || null;
}

/** Devuelve la sesión de esta carga de página; si todavía no se ha
 *  verificado, la verifica contra el backend (nunca redirige). Async: ver
 *  cabecera del archivo. */
export async function obtenerSesion() {
  return sesionEnMemoria || obtenerSesionVerificada();
}

export async function cerrarSesion() {
  // Cierre de sesión REAL: borra la cookie httpOnly en el servidor
  // (API_Auth_PetCore). logout() vive en services/login_service.js (el
  // fetch va en el service, no acá) y ya no lanza si falla.
  const { logout } = await import("../services/login_service.js");
  await logout();

  sesionEnMemoria = null;
  invalidarSesionCache();
}

/** Verifica la sesión contra el backend (SIEMPRE, nunca confía en un
 *  caché viejo) y, si es válida, trae la ficha completa del propietario
 *  (pro_nombre/pro_apellido/pro_foto_url, que /me no incluye) y la
 *  deja en memoria para esta carga. Devuelve null sin redirigir
 *  a ningún lado si no hay sesión -- quien llama decide qué hacer. */
export async function obtenerSesionVerificada() {
  const verificacion = await verificarSesionAsync();
  if (!verificacion || !verificacion.authenticated || verificacion.tipo !== "PROPIETARIO") {
    return null;
  }

  const propietario = await obtenerPropietarioAsync(verificacion.id);

  const sesion = {
    pro_id: verificacion.id,
    pro_nombre: propietario?.pro_nombre || "",
    pro_apellido: propietario?.pro_apellido || "",
    nombre: propietario ? `${propietario.pro_nombre || ""} ${propietario.pro_apellido || ""}`.trim() : (verificacion.nombreUsuario || "Usuario"),
    correo: verificacion.correo,
    pro_foto_url: propietario?.pro_foto_url || null
  };

  guardarSesion(sesion);
  return sesion;
}

/* Protege una página: verifica la sesión contra el backend (cookie
   httpOnly), SIEMPRE -- nunca confía en un caché viejo, ni siquiera el de
   esta misma pestaña, porque antes un script (o alguien con DevTools)
   podía escribir "pc_sesion" a mano y colarse. Si no hay sesión válida, redirige al login. */
export async function requerirSesion() {
  const sesion = await obtenerSesionVerificada();
  if (!sesion) {
    window.location.href = "login.html";
    return null;
  }
  return sesion;
}
