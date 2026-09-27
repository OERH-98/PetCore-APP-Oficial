/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/recuperar_contrasena_controller.js
   Controller de pages/recuperar_contrasena.html -- 3 pasos: pedir código,
   verificarlo, restablecer la contraseña. Mismo patrón que el frontend de
   escritorio, contra los endpoints /recuperar/propietario de Auth_API.
   ========================================================================== */
import {
    solicitarCodigoRecuperacion,
    verificarCodigoRecuperacion,
    restablecerContraseniaConCodigo
} from "../services/recuperar_contrasena_service.js";
import { iniciarSelectorTema } from "./utils.js";

document.addEventListener("DOMContentLoaded", function () {
    iniciarSelectorTema(".pc-tema-toggle-btn", "pc_tema_login");
});

function iniciarRecuperarContrasena() {
    const pasoCorreo = document.getElementById("pcPasoCorreo");
    const pasoCodigo = document.getElementById("pcPasoCodigo");
    const pasoNuevaClave = document.getElementById("pcPasoNuevaClave");

    const formCorreo = document.getElementById("pcFormCorreo");
    const formCodigo = document.getElementById("pcFormCodigo");
    const formNuevaClave = document.getElementById("pcFormNuevaClave");

    if (!formCorreo || !formCodigo || !formNuevaClave) return;

    const inputCorreo = document.getElementById("pcCorreoRecuperar");
    const inputCodigo = document.getElementById("pcCodigoRecuperar");
    const inputClaveNueva = document.getElementById("pcClaveNueva");
    const inputClaveConfirmar = document.getElementById("pcClaveConfirmar");
    const correoConfirmado = document.getElementById("pcCorreoConfirmado");
    const error = document.getElementById("pcRecuperarError");
    const btnReenviar = document.getElementById("pcBtnReenviarCodigo");

    // El correo se necesita en los 3 pasos -- Auth_API revalida el código
    // otra vez en "restablecer", no confía en que "verificar" ya haya pasado.
    let correoEnRecuperacion = "";

    function mostrarError(mensaje) {
        error.textContent = mensaje;
        error.classList.remove("d-none");
    }

    function ocultarError() {
        error.classList.add("d-none");
    }

    // No oculta el error acá a propósito: cuando un código expira, el
    // llamador primero muestra el motivo con mostrarError() y DESPUÉS
    // regresa al paso 1 con irAPaso() -- si esta función limpiara el
    // error, ese mensaje desaparecería justo al llegar al paso 1. Quien
    // SÍ debe limpiarlo es cada formulario, antes de intentar un envío
    // nuevo (ver ocultarError() al inicio de cada submit).
    function irAPaso(pasoMostrar, ...pasosOcultar) {
        pasosOcultar.forEach((p) => p.classList.add("d-none"));
        pasoMostrar.classList.remove("d-none");
    }

    function conBotonDeshabilitado(boton, textoCargando, accion) {
        const textoOriginal = boton.textContent;
        boton.disabled = true;
        boton.textContent = textoCargando;
        return accion().finally(() => {
            boton.disabled = false;
            boton.textContent = textoOriginal;
        });
    }

    // --- Ver/ocultar la contraseña nueva ---
    const btnVerClave = document.getElementById("pcVerClaveNueva");
    if (btnVerClave) {
        btnVerClave.addEventListener("click", function () {
            const oculto = inputClaveNueva.type === "password";
            inputClaveNueva.type = oculto ? "text" : "password";
            btnVerClave.innerHTML = '<i class="fa-regular ' + (oculto ? "fa-eye" : "fa-eye-slash") + '"></i>';
        });
    }

    // --- Paso 1: pedir el código ---
    formCorreo.addEventListener("submit", function (evento) {
        evento.preventDefault();
        const correoValor = inputCorreo.value.trim();
        inputCorreo.value = correoValor;
        if (!correoValor || !inputCorreo.checkValidity()) {
            mostrarError("Escribe un correo válido.");
            inputCorreo.focus();
            return;
        }

        ocultarError();
        conBotonDeshabilitado(document.getElementById("pcBtnEnviarCodigo"), "Enviando...", function () {
            return solicitarCodigoRecuperacion(correoValor)
                .then(function () {
                    correoEnRecuperacion = correoValor;
                    correoConfirmado.textContent = correoValor;
                    inputCodigo.value = "";
                    irAPaso(pasoCodigo, pasoCorreo, pasoNuevaClave);
                    inputCodigo.focus();
                })
                .catch(function (err) {
                    mostrarError(err.message || "No se pudo enviar el código.");
                });
        });
    });

    // --- Paso 2: verificar el código ---
    formCodigo.addEventListener("submit", function (evento) {
        evento.preventDefault();
        const codigoValor = inputCodigo.value.trim();
        if (!codigoValor) return;

        ocultarError();
        conBotonDeshabilitado(document.getElementById("pcBtnVerificarCodigo"), "Verificando...", function () {
            return verificarCodigoRecuperacion(correoEnRecuperacion, codigoValor)
                .then(function () {
                    irAPaso(pasoNuevaClave, pasoCodigo, pasoCorreo);
                })
                .catch(function (err) {
                    mostrarError(err.message || "El código no es válido.");
                    // Código expirado/sin intentos: de vuelta al paso 1 a pedir uno nuevo.
                    if (err.status === 404) {
                        irAPaso(pasoCorreo, pasoCodigo, pasoNuevaClave);
                    }
                });
        });
    });

    // --- Reenviar código (enfriamiento de 60s, mismo límite que Auth_API) ---
    let reenvioBloqueadoHasta = 0;
    if (btnReenviar) {
        btnReenviar.addEventListener("click", function () {
            if (!correoEnRecuperacion || Date.now() < reenvioBloqueadoHasta) return;

            solicitarCodigoRecuperacion(correoEnRecuperacion)
                .then(function () {
                    reenvioBloqueadoHasta = Date.now() + 60_000;
                    const textoOriginal = "Reenviar código";
                    btnReenviar.disabled = true;
                    let segundosRestantes = 60;
                    const intervalo = setInterval(function () {
                        segundosRestantes--;
                        if (segundosRestantes <= 0) {
                            clearInterval(intervalo);
                            btnReenviar.disabled = false;
                            btnReenviar.textContent = textoOriginal;
                            return;
                        }
                        btnReenviar.textContent = "Reenviar código (" + segundosRestantes + "s)";
                    }, 1000);
                })
                .catch(function (err) {
                    mostrarError(err.message || "No se pudo reenviar el código.");
                });
        });
    }

    // --- Paso 3: restablecer la contraseña ---
    formNuevaClave.addEventListener("submit", function (evento) {
        evento.preventDefault();
        const claveNueva = inputClaveNueva.value;
        const claveConfirmar = inputClaveConfirmar.value;
        const codigoValor = inputCodigo.value.trim();

        if (claveNueva.length < 8) {
            mostrarError("La contraseña debe tener al menos 8 caracteres.");
            return;
        }
        if (claveNueva !== claveConfirmar) {
            mostrarError("Las contraseñas no coinciden.");
            return;
        }

        ocultarError();
        conBotonDeshabilitado(document.getElementById("pcBtnRestablecerClave"), "Restableciendo...", function () {
            return restablecerContraseniaConCodigo(correoEnRecuperacion, codigoValor, claveNueva)
                .then(function () {
                    window.location.href = "login.html";
                })
                .catch(function (err) {
                    mostrarError(err.message || "No se pudo restablecer la contraseña.");
                    // El código pudo expirar entre el paso 2 y este.
                    if (err.status === 404) {
                        irAPaso(pasoCorreo, pasoCodigo, pasoNuevaClave);
                    }
                });
        });
    });
}

document.addEventListener("DOMContentLoaded", iniciarRecuperarContrasena);
