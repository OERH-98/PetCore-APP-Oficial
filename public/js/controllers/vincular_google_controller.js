/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/vincular_google_controller.js
   Controller de pages/vincular_google.html -- reemplaza al popup de
   SweetAlert2 que antes abría login_controller.js cuando Auth_API respondía
   409 (ya existe una cuenta con ese correo, con contraseña propia, y hace
   falta confirmarla para completar el enlace con Google).

   El idToken de Google (y el mensaje del backend) llegan por sessionStorage
   -- login_controller.js los deja ahí justo antes de navegar aquí, porque
   ese token solo vivía en una variable JS en memoria, y una navegación de
   página completa la pierde. Se leen y se BORRAN de inmediato (no en
   preConfirm/éxito) para que no quede un token reutilizable si alguien deja
   la pestaña abierta en esta página después de cancelar.
   ========================================================================== */
import { loginPropietarioConGoogle } from "../services/login_service.js";
import { obtenerSesionVerificada, iniciarSelectorTema, iniciarNavegacionAtras } from "./utils.js";

const CLAVE_IDTOKEN = "pc_google_vinculacion_idtoken";
const CLAVE_MENSAJE = "pc_google_vinculacion_mensaje";

document.addEventListener("DOMContentLoaded", async function () {
  iniciarSelectorTema(".pc-tema-toggle-btn", "pc_tema_login");
  iniciarNavegacionAtras();

  const form = document.getElementById("pcFormVincular");
  if (!form) return;

  if (await obtenerSesionVerificada()) {
    window.location.href = "dashboard.html";
    return;
  }

  const idToken = sessionStorage.getItem(CLAVE_IDTOKEN);
  const mensaje = sessionStorage.getItem(CLAVE_MENSAJE);
  sessionStorage.removeItem(CLAVE_IDTOKEN);
  sessionStorage.removeItem(CLAVE_MENSAJE);

  // Sin idToken no hay nada que vincular -- alguien llegó a esta página
  // directamente (o recargó después de que ya se limpió), así que no tiene
  // caso mostrar el formulario.
  if (!idToken) {
    window.location.href = "login.html";
    return;
  }

  const textoAyuda = document.getElementById("pcVincularTexto");
  if (textoAyuda && mensaje) textoAyuda.textContent = mensaje;

  const clave = document.getElementById("pcVincularClave");
  const error = document.getElementById("pcVincularError");
  const boton = document.getElementById("pcBtnVincular");
  const verClave = document.getElementById("pcVerVincularClave");
  const textoBotonOriginal = boton.innerHTML;

  if (verClave) {
    verClave.addEventListener("click", function () {
      const oculto = clave.type === "password";
      clave.type = oculto ? "text" : "password";
      verClave.innerHTML = '<i class="fa-regular ' + (oculto ? "fa-eye" : "fa-eye-slash") + '"></i>';
      verClave.setAttribute("aria-label", oculto ? "Ocultar contraseña" : "Mostrar contraseña");
    });
  }

  function mostrarError(texto) {
    error.textContent = texto;
    error.classList.remove("d-none");
  }

  form.addEventListener("submit", function (evento) {
    evento.preventDefault();

    const claveValor = clave.value;
    if (!claveValor) {
      mostrarError("Escribe tu contraseña actual.");
      clave.focus();
      return;
    }

    error.classList.add("d-none");
    boton.disabled = true;
    boton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Vinculando';

    loginPropietarioConGoogle(idToken, claveValor)
      .then(function () {
        window.location.href = "dashboard.html";
      })
      .catch(function (err) {
        const mensajeError = err?.status === 401
          ? "Contraseña incorrecta."
          : (err?.message || "No se pudo conectar con el servidor. Intenta más tarde.");
        mostrarError(mensajeError);
        boton.disabled = false;
        boton.innerHTML = textoBotonOriginal;
      });
  });
});
