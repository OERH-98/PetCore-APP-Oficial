/* ==========================================================================
   PetCore — Portal de Propietarios
   js/services/login_service.js
   Login real contra Auth_API (mismo patrón que el frontend de escritorio en
   js/services/login_service.js), pero contra /auth/login/propietario en vez
   de /auth/login/empleado -- en el portal de propietarios quien inicia
   sesión es un registro de TBL_PROPIETARIOS, no un empleado.

   Responde PropietarioLoginResponseDTO: { nombre, idPropietario }. Ese
   "nombre" es en realidad PRO_NOMBRE_USUARIO (el usuario con el que se
   logueó), no el nombre real del propietario -- login_controller.js pide el
   registro completo con obtenerPropietarioPorId(idPropietario) después de
   este login para tener pro_nombre/pro_apellido/pro_correo reales.
   ========================================================================== */
const API_URL_LOGIN = "https://petcore-8afada45fabc.herokuapp.com/api/auth/login/propietario";
const API_URL_LOGIN_GOOGLE = "https://petcore-8afada45fabc.herokuapp.com/api/auth/login/propietario/google";
const API_URL_LOGOUT = "https://petcore-8afada45fabc.herokuapp.com/api/auth/logout";

// Debe ser EXACTAMENTE el mismo Client ID que GOOGLE_OAUTH_CLIENT_ID en el
// .env de Auth_API -- ahí es donde de verdad se valida como "audience" del
// token (este valor es público a propósito, así es como funciona Google
// Identity Services: el Client ID va en el navegador, el secreto nunca).
// Centralizado acá (no en login_controller.js) para no tener que buscarlo
// en dos archivos el día que se rote o se pase a un proyecto de Google distinto.
export const GOOGLE_CLIENT_ID = "242597916961-lgb8pq6foda8670mm0hgk4ftk1clflmg.apps.googleusercontent.com";

/* ---- Google nativo (Android/iOS, plugin @capgo/capacitor-social-login) ----
   Las páginas viven en public/ (no pasan por Vite), por eso el plugin se toma
   de window.Capacitor.Plugins en vez de importarlo. El ID token que devuelve
   lleva como audiencia el client ID WEB (webClientId / iOSServerClientId),
   que es el que verifica el backend (GOOGLE_OAUTH_CLIENT_ID). */
// Client ID de tipo iOS (Google Cloud > Credenciales > ID de cliente de OAuth > iOS)
const GOOGLE_IOS_CLIENT_ID = "REEMPLAZAR_CON_TU_IOS_CLIENT_ID.apps.googleusercontent.com";

export function esAppNativa() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

let socialLoginInicializado = false;

export async function obtenerIdTokenGoogleNativo() {
  // En Capacitor, Plugins solo trae los plugins ya registrados en JS; como
  // estas páginas no importan el paquete, se registra el proxy por nombre.
  const SocialLogin = window.Capacitor?.Plugins?.SocialLogin
    || window.Capacitor?.registerPlugin?.("SocialLogin");
  if (!SocialLogin) throw new Error("Plugin SocialLogin no disponible");

  if (!socialLoginInicializado) {
    await SocialLogin.initialize({
      google: {
        webClientId: GOOGLE_CLIENT_ID,
        iOSClientId: GOOGLE_IOS_CLIENT_ID,
        iOSServerClientId: GOOGLE_CLIENT_ID,
        mode: "online"
      }
    });
    socialLoginInicializado = true;
  }

  // Sin "scopes" a propósito: en Android el plugin los exige junto con un
  // cambio en MainActivity, y el ID token ya trae correo y nombre.
  const login = await SocialLogin.login({ provider: "google", options: {} });
  return login?.result?.idToken || null;
}

// POST /api/auth/logout -- borra la cookie httpOnly "authToken" en el
// servidor (no distingue empleado/propietario, solo borra la que haya).
// No lanza si falla: quien llama (cerrarSesion en sesion_utils.js) igual
// limpia localStorage y redirige al login aunque el backend no responda.
export async function logout() {
    try {
        await fetch(API_URL_LOGOUT, { method: "POST" });
    } catch (error) {
        console.warn("No se pudo cerrar la sesión en el servidor:", error);
    }
}

export async function loginPropietario(correo, contrasena) {
    try {
        const respuesta = await fetch(API_URL_LOGIN, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // Nombres exactos que espera AuthDTO en el Auth_API
            body: JSON.stringify({
                correo: correo,
                contrasenia: contrasena
            })
        });

        // .catch(() => null): si Auth_API responde sin body JSON (401/500
        // vacío, o un proxy devolviendo HTML), .json() por sí solo lanzaría
        // aquí y nunca llegaríamos a leer respuesta.status más abajo -- el
        // login mostraría "No se pudo conectar con el servidor" en vez del
        // mensaje real de credenciales inválidas.
        const cuerpo = await respuesta.json().catch(() => null);

        if (!respuesta.ok) {
            // Auth_API responde {timestamp, status, error, message, path, details}
            // en los errores (credenciales inválidas, campos vacíos, etc.).
            const error = new Error(cuerpo?.message || "Credenciales incorrectas o error en el servidor");
            error.status = respuesta.status;
            throw error;
        }

        return cuerpo;
    }
    catch (error) {
        console.error("Error al iniciar sesión:", error);
        throw error;
    }
}

/* "Iniciar sesión con Google" -- SOLO enlaza/activa una cuenta que la
   clínica ya creó, nunca registra una desde cero (ver
   AuthServiceImpl.loginPropietarioConGoogle en Auth_API). Respuestas:
     200 -> login normal (PropietarioLoginResponseDTO), igual que loginPropietario.
     409 -> ya existe una cuenta con este correo y contraseña propia; hay
            que reintentar mandando "contrasenia" para confirmar el enlace.
     404 -> no existe ninguna cuenta con ese correo (no se autorregistra). */
export async function loginPropietarioConGoogle(idToken, contrasenia) {
    try {
        const respuesta = await fetch(API_URL_LOGIN_GOOGLE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                idToken: idToken,
                contrasenia: contrasenia || undefined
            })
        });

        const cuerpo = await respuesta.json().catch(() => null);

        if (!respuesta.ok) {
            const error = new Error(cuerpo?.message || "No se pudo iniciar sesión con Google");
            error.status = respuesta.status;
            throw error;
        }

        return cuerpo;
    }
    catch (error) {
        console.error("Error al iniciar sesión con Google:", error);
        throw error;
    }
}
