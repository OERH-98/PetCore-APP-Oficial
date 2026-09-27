/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/login_controller.js
   Controller de pages/login.html. Login real contra Auth_API (mismo patrón
   que el frontend de escritorio en js/controllers/login_controller.js):
   POST /api/auth/login/propietario con {correo, contrasenia}, verificado con
   Argon2id contra PRO_CONTRASENIA en TBL_PROPIETARIOS -- ya no es una
   búsqueda por correo sin verificar contraseña.

   La respuesta de Auth_API (PropietarioLoginResponseDTO) solo trae
   { nombre: <PRO_NOMBRE_USUARIO>, idPropietario }, no el nombre real ni el
   correo -- por eso, tras un login exitoso, se pide el registro completo
   con obtenerPropietarioPorId(idPropietario) a la API principal para poder
   guardar pro_nombre/pro_apellido/pro_correo reales en la sesión (el resto
   del portal, dashboard incluido, ya espera esos campos en sesion).
   ========================================================================== */
import { loginPropietario, loginPropietarioConGoogle, GOOGLE_CLIENT_ID, esAppNativa, obtenerIdTokenGoogleNativo } from "../services/login_service.js";
import { obtenerSesionVerificada, iniciarSelectorTema } from "./utils.js";

/* Toggle de tema propio de login.html: pantalla "fuera de la app", así que
   usa su propia preferencia global (pc_tema_login) en vez de una por
   propietario -- todavía no hay sesión en este punto. index.html hereda
   esta misma preferencia para la pantalla de carga (ver
   tema_temprano_login.js). */
document.addEventListener("DOMContentLoaded", function () {
  iniciarSelectorTema(".pc-tema-toggle-btn", "pc_tema_login");
});

function iniciarLogin() {
  const form = document.getElementById("pcFormLogin");
  if (!form) return;

  // Si la cookie de sesión sigue siendo válida (verificado contra el
  // backend, no un caché local), no tiene sentido mostrar el login otra vez.
  if (obtenerSesionVerificada()) {
    window.location.href = "dashboard.html";
    return;
  }

  const correo = document.getElementById("pcUsuario");
  const clave = document.getElementById("pcClave");
  const error = document.getElementById("pcLoginError");
  const boton = document.getElementById("pcBtnEntrar");
  const verClave = document.getElementById("pcVerClave");
  const textoBotonOriginal = boton.innerHTML;

  if (verClave) {
    verClave.addEventListener("click", function () {
      const oculto = clave.type === "password";
      clave.type = oculto ? "text" : "password";
      verClave.innerHTML = '<i class="fa-regular ' + (oculto ? "fa-eye" : "fa-eye-slash") + '"></i>';
      verClave.setAttribute("aria-label", oculto ? "Ocultar contraseña" : "Mostrar contraseña");
    });
  }

  function mostrarError(mensaje) {
    error.textContent = mensaje;
    error.classList.remove("d-none");
  }

  function volverAHabilitar() {
    boton.disabled = false;
    boton.innerHTML = textoBotonOriginal;
  }

  form.addEventListener("submit", function (evento) {
    evento.preventDefault();

    const correoValor = correo.value.trim();
    const claveValor = clave.value;

    // correo.type="email" ya valida el formato en el navegador, pero como el
    // form usa "novalidate" + checks manuales, hay que invocar esa misma
    // validación nativa (checkValidity) en vez de un chequeo débil propio.
    correo.value = correoValor;
    if (!correoValor || !correo.checkValidity()) {
      mostrarError("Escribe un correo válido, con el que te registraste en la clínica.");
      correo.focus();
      return;
    }

    if (!claveValor) {
      mostrarError("Escribe tu contraseña.");
      clave.focus();
      return;
    }

    error.classList.add("d-none");
    boton.disabled = true;
    boton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verificando';

    loginPropietario(correoValor, claveValor)
      .then(function () {
        // La sesión ya quedó en la cookie httpOnly: el dashboard la lee del
        // backend con requerirSesion(), no hay nada que guardar acá.
        window.location.href = "dashboard.html";
      })
      .catch(function (err) {
        // Auth_API responde 401 con "Credenciales de propietario inválidas"
        // para correo inexistente o contraseña incorrecta (no distingue
        // cuál de las dos, a propósito, para no filtrar qué correos existen).
        const mensaje = err?.status === 401
          ? "Correo o contraseña incorrectos."
          : "No se pudo conectar con el servidor. Intenta más tarde.";
        mostrarError(mensaje);
        volverAHabilitar();
      });
  });

  /* ==========================================================================
     "Iniciar sesión con Google" -- SOLO enlaza/activa una cuenta que la
     clínica ya creó (ver AuthServiceImpl.loginPropietarioConGoogle), nunca
     registra un propietario nuevo. Google Identity Services le entrega a
     este callback un ID token ya firmado por Google (credentialResponse);
     ese token, no un correo suelto, es lo único que se manda al backend.
     ========================================================================== */
  async function iniciarSesionConGoogle(idToken, contraseniaConfirmacion) {
    try {
      await loginPropietarioConGoogle(idToken, contraseniaConfirmacion);
      window.location.href = "dashboard.html";
    } catch (err) {
      // 409: ya existe una cuenta con este correo y con SU PROPIA
      // contraseña -- hace falta confirmarla una vez para completar el
      // enlace (ver VinculacionRequeridaException en Auth_API). No se
      // enlaza en silencio para no dejar que cualquiera con un Google del
      // mismo correo se apropie de una cuenta con contraseña ajena.
      //
      // El idToken (y el mensaje del backend) se guardan en sessionStorage
      // -- no en una variable JS -- porque el paso de confirmación ahora es
      // una página propia (vincular_google.html) en vez de un popup: navegar
      // a otra página pierde cualquier estado que solo viviera en memoria.
      if (err?.status === 409) {
        sessionStorage.setItem("pc_google_vinculacion_idtoken", idToken);
        if (err.message) sessionStorage.setItem("pc_google_vinculacion_mensaje", err.message);
        window.location.href = "vincular_google.html";
        return;
      }

      // 404: no existe ningún propietario con ese correo -- a propósito NO
      // se autorregistra una cuenta nueva (ver decisión de producto: el
      // portal solo es para clientes que la clínica ya registró).
      const mensaje = err?.status === 404
        ? (err.message || "No existe ninguna cuenta con ese correo. Regístrate primero en la clínica.")
        : err?.status === 401
          ? (err.message || "No se pudo verificar tu cuenta de Google.")
          : "No se pudo conectar con el servidor. Intenta más tarde.";

      mostrarError(mensaje);
    }
  }

  const contenedorBotonGoogle = document.getElementById("pcGoogleBtnContenedor");

  // Dentro de la app (Android/iOS) Google bloquea OAuth en el WebView, así
  // que ahí se usa el selector NATIVO de cuentas (plugin SocialLogin) y el
  // botón web de Google Identity Services no se dibuja.
  if (contenedorBotonGoogle && esAppNativa()) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn btn-outline-secondary rounded-pill px-4";
    boton.innerHTML = 'Continuar con Google';
    boton.addEventListener("click", async function () {
      error.classList.add("d-none");
      boton.disabled = true;
      try {
        const idToken = await obtenerIdTokenGoogleNativo();
        if (idToken) await iniciarSesionConGoogle(idToken, null);
        else mostrarError("No se pudo obtener tu cuenta de Google.");
      } catch (e) {
        // Cancelar el selector también cae acá: no se muestra como error
        if (!/cancel/i.test(String(e?.message || e))) {
          mostrarError("No se pudo iniciar sesión con Google.");
        }
      } finally {
        boton.disabled = false;
      }
    });
    contenedorBotonGoogle.appendChild(boton);
  } else if (contenedorBotonGoogle && typeof google !== "undefined" && google.accounts?.id) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: function (credencial) {
        error.classList.add("d-none");
        iniciarSesionConGoogle(credencial.credential, null);
      }
    });

    // El botón de Google (y la fila de "Continuar como <nombre>" que Google
    // dibuja adentro cuando detecta una sesión de Google activa en el
    // navegador) es un <iframe> que Google pinta a SU manera con lo que se
    // le pase en "theme" -- "outline" es un botón blanco pensado para fondo
    // claro, y en modo oscuro se ve como un recuadro blanco fuera de lugar.
    // "filled_black" es la variante que Google diseñó para fondos oscuros.
    function esTemaOscuro() {
      return document.documentElement.dataset.theme === "dark";
    }

    function dibujarBotonGoogle() {
      contenedorBotonGoogle.innerHTML = "";
      google.accounts.id.renderButton(contenedorBotonGoogle, {
        type: "standard",
        theme: esTemaOscuro() ? "filled_black" : "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 320
      });
    }

    dibujarBotonGoogle();

    // iniciarSelectorTema() (arriba) ya cambia el atributo data-theme al
    // hacer clic en estos mismos botones -- acá solo se vuelve a dibujar el
    // de Google con el theme correcto, sin duplicar esa lógica.
    document.querySelectorAll(".pc-tema-toggle-btn").forEach(function (boton) {
      boton.addEventListener("click", dibujarBotonGoogle);
    });
  }
}

document.addEventListener("DOMContentLoaded", iniciarLogin);
