/* ==========================================================================
   PetCore — Portal de Propietarios
   js/services/sesion_temprana_service.js
   GET /api/auth/me/propietario -- quién soy, según la cookie httpOnly
   "authTokenPropietario" (variante propia de propietario: responde según
   ESA cookie sin importar si en el mismo navegador hay una sesión de
   empleado abierta en PC).

   Es un <script> clásico (no type="module") a propósito, igual que
   sesion_service.js en el frontend de escritorio: tema_temprano.js
   necesita el pro_id ANTES del primer render y los módulos se difieren
   hasta después de parsear el HTML. El fetch/XHR a la API vive acá (en
   un service), nunca en tema_temprano.js. services/sesion_service.js
   (módulo) reutiliza este mismo resultado en vez de repetir la petición.

   Memo por carga de página, incluido el "no hay sesión".
   ========================================================================== */
(function () {
  "use strict";
  if (window.SesionTempranaService) return;

  var API_URL_ME = "https://petcore-8afada45fabc.herokuapp.com/api/auth/me/propietario";

  // Mismo truco que fetch_con_credenciales.js, pero para XHR: si la página se
  // sirve desde 127.0.0.1 (Live Server) en vez de localhost, se apunta el XHR
  // ahí también -- si no, el navegador no mandaría la cookie de sesión.
  function conMismoHost(url) {
    return url.replace(/^(https?:\/\/)(?:localhost|127\.0\.0\.1)(:(?:8080|8081)\b)/, "$1" + window.location.hostname + "$2");
  }

  // La API envuelve toda respuesta en {success, message, data}: se devuelve
  // solo "data" (igual que el wrapper de fetch() en fetch_con_credenciales.js).
  function desenvolverApiResponse(cuerpo) {
    var esEnvoltorio = cuerpo !== null && typeof cuerpo === "object" && !Array.isArray(cuerpo)
      && typeof cuerpo.success === "boolean" && "message" in cuerpo && "data" in cuerpo
      && Object.keys(cuerpo).length === 3;
    return esEnvoltorio ? cuerpo.data : cuerpo;
  }

  var verificada = false;
  var datos = null;

  function verificarSesionSync() {
    if (!verificada) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", conMismoHost(API_URL_ME), false);
        xhr.withCredentials = true;
        xhr.send(null);
        datos = xhr.status >= 200 && xhr.status < 300 ? desenvolverApiResponse(JSON.parse(xhr.responseText)) : null;
      } catch (e) {
        console.error("No se pudo verificar la sesión:", e);
        datos = null;
      }
      verificada = true;
    }
    return datos;
  }

  // Caché SEPARADA de la de verificarSesionSync(): un XHR síncrono no lo
  // puede interceptar el puente nativo CapacitorHttp/CapacitorCookies (ese
  // puente pasa mensajes a nativo de forma asíncrona, y una petición
  // síncrona no puede esperar esa respuesta), así que en iOS ese XHR
  // siempre falla aunque SÍ haya sesión válida -- lo usa solo
  // tema_temprano.js, que es cosmético (tema/daltonismo) y puede vivir con
  // ese "sin sesión" temporal. requerirSesion() (el gate real de las
  // páginas protegidas) usa ESTA versión con fetch() en su lugar, que sí
  // pasa por el puente nativo y sí lleva la cookie en iOS.
  // Memoizado con la promesa misma (no un booleano aparte): una vez creada,
  // siempre se devuelve esa MISMA promesa -- pendiente o ya resuelta, da
  // igual, un .then() sobre una promesa ya resuelta sigue funcionando bien.
  var promesaAsync = null;

  function verificarSesionAsync() {
    if (promesaAsync) return promesaAsync;

    promesaAsync = fetch(conMismoHost(API_URL_ME), { credentials: "include" })
      .then(function (resp) {
        if (!resp.ok) return null;
        return resp.json().then(desenvolverApiResponse);
      })
      .catch(function (e) {
        console.error("No se pudo verificar la sesión (async):", e);
        return null;
      })
      .then(function (resultado) {
        // Comparte el resultado con la caché síncrona: si tema_temprano.js
        // todavía no corrió (o corrió y falló en iOS), que reutilice este
        // resultado en vez de repetir la petición.
        if (!verificada) { verificada = true; datos = resultado; }
        return resultado;
      });
    return promesaAsync;
  }

  /** Descarta lo memorizado (sesión que cambia sin recargar la página). */
  function invalidarSesionCache() {
    verificada = false;
    datos = null;
    promesaAsync = null;
  }

  window.SesionTempranaService = {
    verificarSesionSync: verificarSesionSync,
    verificarSesionAsync: verificarSesionAsync,
    invalidarSesionCache: invalidarSesionCache
  };
})();
