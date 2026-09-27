/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/fetch_con_credenciales.js
   Ahora API_PetCore y API_Auth_PetCore usan una cookie httpOnly
   ("authToken") en vez de localStorage para la sesión -- CADA fetch()
   necesita "credentials: include" para que el navegador la mande -- las
   dos APIs viven en un puerto distinto al de este frontend (8080/8081 vs
   el de XAMPP), así que sin esto es un origen cruzado y la cookie
   simplemente no viaja.

   En vez de tocar cada *_service.js se parchea fetch() una sola vez,
   acá, cargado como <script> clásico (no type="module") junto a
   tema_temprano(_login).js -- por eso corre ANTES que cualquier
   controller type="module" de la página: los módulos siempre se difieren
   hasta que el HTML termina de parsearse, pero un <script> clásico corre
   apenas el parser lo encuentra.

   SEGUNDO PROBLEMA, además de "credentials" -- cada *_service.js apunta
   a http://localhost:8080/8081 a mano. Si esta página NO se sirve desde
   "localhost" (p. ej. la extensión Live Server de VS Code, que por
   defecto abre http://127.0.0.1:PUERTO), el navegador considera
   "localhost" y "127.0.0.1" SITIOS DISTINTOS para efecto de cookies
   (SameSite mira el host, no si "en la práctica" son la misma máquina) --
   la petición pasaría CORS pero el navegador igual se negaría a mandar o
   guardar la cookie de sesión, por ser cross-site. Por eso, si el origen
   de ESTA página no es "localhost", se reescribe el host del fetch para
   que coincida con el de la página (mismo puerto 8080/8081, solo cambia
   el host) -- así el backend y el frontend siempre quedan en el mismo
   "sitio", sea cual sea el host real que se esté usando.

   TERCER PROBLEMA -- "sacar de la sesión" cuando deja de haber un usuario
   activo (cookie vencida/borrada) o el propietario ya no existe (cuenta
   eliminada mientras la pestaña seguía abierta). requerirSesion() (ver
   utils/sesion_utils.js) ya cubre la carga de CADA página -- pero si el
   propietario se queda un buen rato EN una misma página y la sesión muere
   mientras tanto, la primera señal de eso es que alguno de los fetch() de
   ese momento responde 401/403 (API_Auth_PetCore devuelve 401 explícito
   en /me y /login; API_PetCore, sin AuthenticationEntryPoint propio,
   devuelve 403 por defecto de Spring Security tanto sin sesión como con
   rol insuficiente -- pero el mobile nunca le pega a un endpoint fuera de
   lo que PROPIETARIO tiene permitido, así que en la práctica un 403 acá
   SIEMPRE significa "la sesión ya no sirve"). Por eso se revisa la
   respuesta de cada fetch acá mismo, en el único lugar por el que pasan
   todos: si no fue a /api/auth/ (login, /me, verificar/cambiar
   contraseña -- esos YA manejan su propio 401 como parte del flujo normal
   de la página, no como sesión perdida) y vino 401/403, se manda a
   login.html sin esperar a la siguiente carga de página.

   El POST a /api/auth/logout para borrar la cookie en el servidor sigue
   la misma regla que el resto de la app -- todo fetch/XHR a cualquiera de
   las 2 APIs va en su propio service, nunca en un controller -- así que
   acá solo se importa dinámicamente logout() de services/login_service.js
   (el mismo que ya usa cerrarSesion() en utils/sesion_utils.js) en vez de
   llamar a fetch() directo. import() dinámico funciona en un <script>
   clásico igual que en uno type="module" -- no hace falta convertir este
   archivo a módulo solo por esto.
   ========================================================================== */
(function () {
    if (typeof window === "undefined" || !window.fetch || window.fetch.__conCredenciales) return;

    const fetchOriginal = window.fetch.bind(window);
    const hostPagina = window.location.hostname;

    function conMismoHost(recurso) {
        if (typeof recurso !== "string") return recurso;
        return recurso.replace(/^(https?:\/\/)(?:localhost|127\.0\.0\.1)(:(?:8080|8081)\b)/, `$1${hostPagina}$2`);
    }

    // /api/auth/** trae su propio manejo de 401 en cada controller (login
    // incorrecto, contraseña actual incorrecta al cambiarla, /me
    // consultando "¿hay sesión?" a propósito) -- forzar el cierre acá
    // también los interrumpiría.
    const RUTA_SIN_REDIRIGIR = /\/api\/auth\//;

    // Páginas donde ya no hay "afuera" al cual mandar a alguien sin sesión
    // (login/recuperación/vinculación de Google son las únicas que un
    // propietario sin sesión puede visitar).
    const PAGINA_PUBLICA = /\/(login|recuperar_contrasena|vincular_google)\.html(?:$|[?#])/;

    let cerrandoSesion = false;
    function forzarCierreSesion() {
        if (cerrandoSesion || PAGINA_PUBLICA.test(window.location.pathname)) return;
        cerrandoSesion = true;
        // Best-effort: borra la cookie httpOnly en el servidor si todavía
        // sirve de algo -- no se espera a que termine, la redirección no
        // depende de esto. El fetch en sí vive en login_service.js, no acá.
        import("../services/login_service.js").then(function (servicio) {
            return servicio.logout();
        }).catch(function () {});
        window.location.href = "login.html";
    }

    // Las dos APIs envuelven TODA respuesta en {success, message, data}
    // (ApiResponse). Los services siguen leyendo "await respuesta.json()" y
    // esperando el dato de siempre (lista, DTO, número), así que se
    // desenvuelve acá, en el único lugar por el que pasan todas las
    // respuestas. Los errores (4xx/5xx del GlobalExceptionHandler) NO vienen
    // en ese formato y pasan intactos.
    function esApiResponse(cuerpo) {
        return cuerpo !== null && typeof cuerpo === "object" && !Array.isArray(cuerpo)
            && typeof cuerpo.success === "boolean" && "message" in cuerpo && "data" in cuerpo
            && Object.keys(cuerpo).length === 3;
    }

    function desenvolverApiResponse(respuesta) {
        const jsonOriginal = respuesta.json.bind(respuesta);
        respuesta.json = function () {
            return jsonOriginal().then(function (cuerpo) { return esApiResponse(cuerpo) ? cuerpo.data : cuerpo; });
        };
        return respuesta;
    }

    function fetchConCredenciales(recurso, opciones) {
        const opcionesFinales = Object.assign({ credentials: "include" }, opciones || {});
        const url = conMismoHost(recurso);
        return fetchOriginal(url, opcionesFinales).then(function (respuesta) {
            if ((respuesta.status === 401 || respuesta.status === 403) && typeof url === "string" && !RUTA_SIN_REDIRIGIR.test(url)) {
                forzarCierreSesion();
            }
            return desenvolverApiResponse(respuesta);
        });
    }
    fetchConCredenciales.__conCredenciales = true;

    window.fetch = fetchConCredenciales;
})();
