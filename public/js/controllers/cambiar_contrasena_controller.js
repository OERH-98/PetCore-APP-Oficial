/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/cambiar_contrasena_controller.js
   Controller de pages/cambiar_contrasena.html -- reemplaza al flujo de dos
   swal de SweetAlert2 que antes vivía en perfil_controller.js: dos popups
   angostos apilados no se sentían nativos en un celular. Misma lógica de
   dos pasos (verificar la actual, luego pedir la nueva), pero como página
   propia con los campos revelándose uno tras otro.
   Servicio usado: propietarios_service.js.
   ========================================================================== */
import { verificarContraseniaPropietario, cambiarContraseniaPropietario } from "../services/propietarios_service.js";
import { iniciarLayout, requerirSesion } from "./utils.js";

function iniciarTogglePassword(inputId, botonId) {
  const input = document.getElementById(inputId);
  const boton = document.getElementById(botonId);
  if (!input || !boton) return;

  boton.addEventListener("click", function () {
    const oculto = input.type === "password";
    input.type = oculto ? "text" : "password";
    boton.innerHTML = '<i class="fa-regular ' + (oculto ? "fa-eye" : "fa-eye-slash") + '"></i>';
    boton.setAttribute("aria-label", oculto ? "Ocultar contraseña" : "Mostrar contraseña");
  });
}

function mostrarError(elemento, mensaje) {
  if (!elemento) return;
  elemento.textContent = mensaje;
  elemento.classList.remove("d-none");
}

function iniciarCambioContrasena(sesion) {
  const formVerificar = document.getElementById("pcFormVerificar");
  const formNueva = document.getElementById("pcFormNueva");
  const tarjetaExito = document.getElementById("pcExito");
  if (!formVerificar || !formNueva) return;

  const errorVerificar = document.getElementById("pcErrorVerificar");
  const errorNueva = document.getElementById("pcErrorNueva");
  const botonVerificar = document.getElementById("pcBtnVerificar");
  const botonCambiar = document.getElementById("pcBtnCambiar");

  iniciarTogglePassword("pcContrasenaActual", "pcVerActual");
  iniciarTogglePassword("pcContrasenaNueva", "pcVerNueva");
  iniciarTogglePassword("pcContrasenaConfirmar", "pcVerConfirmar");

  let contraseniaActualVerificada = "";

  formVerificar.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    errorVerificar.classList.add("d-none");

    const actual = document.getElementById("pcContrasenaActual").value;
    if (!actual) {
      mostrarError(errorVerificar, "Escribe tu contraseña actual");
      return;
    }

    const textoOriginal = botonVerificar.innerHTML;
    botonVerificar.disabled = true;
    botonVerificar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verificando';

    try {
      await verificarContraseniaPropietario(sesion.pro_id, actual);
      contraseniaActualVerificada = actual;

      // El paso 1 se deja fijo (ya no se puede reabrir sin recargar) para
      // que quede claro cuál contraseña "actual" se usará al confirmar el
      // cambio -- coincide con el mismo criterio que ya usaba el flujo de
      // popups (dos pasos, uno a la vez, sin volver atrás).
      formVerificar.querySelectorAll("input, button").forEach(el => { el.disabled = true; });
      formVerificar.classList.add("opacity-75");
      formNueva.classList.remove("d-none");
      document.getElementById("pcContrasenaNueva").focus();
    } catch (error) {
      mostrarError(errorVerificar, error?.message || "La contraseña actual no es correcta");
    } finally {
      botonVerificar.disabled = false;
      botonVerificar.innerHTML = textoOriginal;
    }
  });

  formNueva.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    errorNueva.classList.add("d-none");

    const nueva = document.getElementById("pcContrasenaNueva").value;
    const confirmar = document.getElementById("pcContrasenaConfirmar").value;

    if (nueva.length < 8 || nueva.length > 300) {
      mostrarError(errorNueva, "La contraseña debe tener entre 8 y 300 caracteres");
      return;
    }
    if (nueva !== confirmar) {
      mostrarError(errorNueva, "Las contraseñas no coinciden");
      return;
    }

    const textoOriginal = botonCambiar.innerHTML;
    botonCambiar.disabled = true;
    botonCambiar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cambiando';

    try {
      await cambiarContraseniaPropietario(sesion.pro_id, contraseniaActualVerificada, nueva);
      formNueva.classList.add("d-none");
      tarjetaExito.classList.remove("d-none");
    } catch (error) {
      mostrarError(errorNueva, error?.message || "No se pudo cambiar la contraseña");
      botonCambiar.disabled = false;
      botonCambiar.innerHTML = textoOriginal;
    }
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  iniciarLayout();

  const sesion = await requerirSesion();
  if (!sesion) return;

  iniciarCambioContrasena(sesion);
});
