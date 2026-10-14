/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/crear_cuenta_controller.js
   Controller de pages/crear_cuenta.html -- 3 pasos: DUI (se envía un código al
   correo que la clínica tiene guardado), código, usuario + contraseña. Mismo
   patrón que recuperar_contrasena_controller.js.
   ========================================================================== */
import {
    solicitarCodigoCuenta,
    verificarCodigoCuenta,
    crearCuenta
} from "../services/crear_cuenta_service.js";
import { iniciarSelectorTema, iniciarNavegacionAtras } from "./utils.js";
import { iniciarContactoClinica } from "../utils/contacto_clinica_utils.js";
import { iniciarMascaraDui, normalizarDui, esDuiValido } from "../utils/dui_utils.js";

import { avisarCampo } from "../utils/avisos_formulario.js";
document.addEventListener("DOMContentLoaded", function () {
    iniciarSelectorTema(".pc-tema-toggle-btn", "pc_tema_login");
    iniciarNavegacionAtras();
    iniciarContactoClinica(); // teléfono de la clínica desde la configuración del sistema
});

function iniciarCrearCuenta() {
    const pasoDui = document.getElementById("pcPasoDui");
    const pasoCodigo = document.getElementById("pcPasoCodigo");
    const pasoCredenciales = document.getElementById("pcPasoCredenciales");

    const formDui = document.getElementById("pcFormDui");
    const formCodigo = document.getElementById("pcFormCodigo");
    const formCredenciales = document.getElementById("pcFormCredenciales");
    if (!formDui || !formCodigo || !formCredenciales) return;

    const inputDui = document.getElementById("pcDui");
    const inputCodigo = document.getElementById("pcCodigo");
    const inputUsuario = document.getElementById("pcNombreUsuario");
    const inputClave = document.getElementById("pcClaveNueva");
    const inputConfirmar = document.getElementById("pcClaveConfirmar");
    const duiConfirmado = document.getElementById("pcDuiConfirmado");
    const error = document.getElementById("pcCuentaError");
    const btnReenviar = document.getElementById("pcBtnReenviarCodigo");

    // El DUI y el código se necesitan en los 3 pasos: el servidor revalida el código al crear la cuenta.
    let duiEnProceso = "";

    function mostrarError(mensaje) {
        error.textContent = mensaje;
        error.classList.remove("d-none");
    }

    function ocultarError() {
        error.classList.add("d-none");
    }

    // No oculta el error a propósito (ver recuperar_contrasena_controller.js): quien cambia de paso por un error
    // lo muestra antes; cada formulario lo limpia al intentar un envío nuevo.
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

    // --- DUI con el guion puesto solo (data-mascara="dui" en el HTML): solo dígitos ---
    iniciarMascaraDui();

    // --- Ver/ocultar la contraseña ---
    const btnVerClave = document.getElementById("pcVerClaveNueva");
    if (btnVerClave) {
        btnVerClave.addEventListener("click", function () {
            const oculto = inputClave.type === "password";
            inputClave.type = oculto ? "text" : "password";
            btnVerClave.innerHTML = '<i class="fa-regular ' + (oculto ? "fa-eye" : "fa-eye-slash") + '"></i>';
        });
    }

    // --- Paso 1: pedir el código con el DUI ---
    formDui.addEventListener("submit", function (evento) {
        evento.preventDefault();
        const duiValor = normalizarDui(inputDui.value);
        inputDui.value = duiValor;
        if (!esDuiValido(duiValor)) {
            ocultarError(); avisarCampo(inputDui, "Escribe tu DUI completo (8 dígitos, guion y 1 dígito).");
            return;
        }

        ocultarError();
        conBotonDeshabilitado(document.getElementById("pcBtnEnviarCodigo"), "Enviando...", function () {
            return solicitarCodigoCuenta(duiValor)
                .then(function () {
                    duiEnProceso = duiValor;
                    duiConfirmado.textContent = duiValor;
                    inputCodigo.value = "";
                    irAPaso(pasoCodigo, pasoDui, pasoCredenciales);
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
            return verificarCodigoCuenta(duiEnProceso, codigoValor)
                .then(function () {
                    irAPaso(pasoCredenciales, pasoCodigo, pasoDui);
                    inputUsuario.focus();
                })
                .catch(function (err) {
                    mostrarError(err.message || "El código no es válido.");
                    // Código expirado/sin intentos: de vuelta al paso 1 a pedir uno nuevo.
                    if (err.status === 404) irAPaso(pasoDui, pasoCodigo, pasoCredenciales);
                });
        });
    });

    // --- Reenviar código (enfriamiento de 60 s, mismo límite que el servidor) ---
    let reenvioBloqueadoHasta = 0;
    if (btnReenviar) {
        btnReenviar.addEventListener("click", function () {
            if (!duiEnProceso || Date.now() < reenvioBloqueadoHasta) return;

            solicitarCodigoCuenta(duiEnProceso)
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

    // --- Paso 3: usuario y contraseña ---
    formCredenciales.addEventListener("submit", function (evento) {
        evento.preventDefault();
        const usuario = inputUsuario.value.trim();
        const clave = inputClave.value;
        const confirmar = inputConfirmar.value;
        const codigoValor = inputCodigo.value.trim();

        if (usuario.length < 4 || usuario.length > 15) {
            ocultarError(); avisarCampo(inputUsuario, "El nombre de usuario debe tener entre 4 y 15 caracteres.");
            return;
        }
        if (!/^[A-Za-z0-9._-]+$/.test(usuario)) {
            ocultarError(); avisarCampo(inputUsuario, "El nombre de usuario solo puede tener letras, números, punto, guion y guion bajo.");
            return;
        }
        if (clave.length < 8 || clave.length > 300) {
            ocultarError(); avisarCampo(inputClave, "La contraseña debe tener entre 8 y 300 caracteres.");
            return;
        }
        if (clave !== confirmar) {
            ocultarError(); avisarCampo(inputConfirmar, "Las contraseñas no coinciden.");
            return;
        }

        ocultarError();
        conBotonDeshabilitado(document.getElementById("pcBtnCrearCuenta"), "Creando cuenta...", function () {
            return crearCuenta(duiEnProceso, codigoValor, usuario, clave)
                .then(function () {
                    // Al login, con el usuario ya puesto y un aviso de que la cuenta quedó lista
                    window.location.href = "login.html?cuenta=creada&usuario=" + encodeURIComponent(usuario);
                })
                .catch(function (err) {
                    mostrarError(err.message || "No se pudo crear la cuenta.");
                    // 404: el código expiró entre el paso 2 y este. Los demás errores (usuario repetido, etc.) se
                    // corrigen en este mismo paso.
                    if (err.status === 404) irAPaso(pasoDui, pasoCodigo, pasoCredenciales);
                });
        });
    });
}

document.addEventListener("DOMContentLoaded", iniciarCrearCuenta);
