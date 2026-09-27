/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/preferencias_controller.js
   Controller de pages/preferencias.html: tema (claro/oscuro/sistema),
   opacidad de la imagen institucional, animaciones y filtro de daltonismo
   -- todo guardado por propietario (pro_id de la sesión). Mismo patrón que
   Preferencias > Apariencia/Accesibilidad en el frontend de escritorio; el
   filtro de daltonismo y las animaciones se reaplican en caliente vía
   window.aplicarAccesibilidadEnTiempoReal(), que expone tema_temprano.js
   (el mismo script que las aplica ANTES del primer render, para no tener
   la lógica de las matrices duplicada en dos archivos).
   ========================================================================== */
import {
  iniciarLayout, requerirSesion, iniciarSelectorTema, aplicarOpacidadFondoInstitucional
} from "./utils.js";
import { crearSliderPersonalizado } from "../utils/slider_personalizado.js";
import { crearSelectPersonalizado } from "../utils/selector_personalizado.js";
import { activarNotificacionesPush, desactivarNotificacionesPush, tieneNotificacionesPushActivas, soportaPush } from "../utils/push_utils.js";

function iniciarOpacidadFondo(proId) {
  const input = document.getElementById("pcOpacidadFondo");
  const label = document.getElementById("pcOpacidadFondoLabel");
  if (!input) return;

  const slider = crearSliderPersonalizado(input);
  const clave = `pc_opacidad_fondo_${proId}`;

  function pintarLabel(valor) {
    if (label) label.textContent = `${valor}%`;
  }

  const guardada = localStorage.getItem(clave);
  input.value = guardada !== null ? guardada : "55";
  slider?.refrescar();
  pintarLabel(input.value);

  // En vivo mientras se arrastra el slider: se guarda y se aplica de
  // inmediato al fondo institucional (si hay uno configurado y visible).
  input.addEventListener("input", function () {
    pintarLabel(input.value);
    localStorage.setItem(clave, input.value);
    aplicarOpacidadFondoInstitucional(proId);
  });
}

function reaplicarAccesibilidad() {
  if (typeof window.aplicarAccesibilidadEnTiempoReal === "function") {
    window.aplicarAccesibilidadEnTiempoReal();
  }
}

function iniciarAnimaciones(proId) {
  const check = document.getElementById("pcSwitchAnimaciones");
  if (!check) return;

  const clave = `pc_animaciones_${proId}`;
  check.checked = localStorage.getItem(clave) !== "false";

  check.addEventListener("change", function () {
    localStorage.setItem(clave, String(check.checked));
    reaplicarAccesibilidad();
  });
}

function iniciarDaltonismo(proId) {
  const select = document.getElementById("pcFiltroDaltonismo");
  const input = document.getElementById("pcIntensidadDaltonismo");
  const label = document.getElementById("pcIntensidadDaltonismoLabel");
  if (!select || !input) return;

  const selectPersonalizado = crearSelectPersonalizado(select);
  const slider = crearSliderPersonalizado(input);

  const claveTipo = `pc_daltonismo_${proId}`;
  const claveIntensidad = `pc_daltonismo_intensidad_${proId}`;

  function pintarLabel(valor) {
    if (label) label.textContent = `${valor}%`;
  }

  function actualizarEstadoIntensidad() {
    input.disabled = select.value === "ninguno";
    slider?.refrescar();
  }

  select.value = localStorage.getItem(claveTipo) || "ninguno";
  selectPersonalizado?.refrescar();

  const intensidadGuardada = localStorage.getItem(claveIntensidad);
  input.value = intensidadGuardada !== null ? intensidadGuardada : "100";
  slider?.refrescar();
  pintarLabel(input.value);
  actualizarEstadoIntensidad();

  select.addEventListener("change", function () {
    localStorage.setItem(claveTipo, select.value);
    actualizarEstadoIntensidad();
    reaplicarAccesibilidad();
  });

  // En vivo mientras se arrastra el slider de intensidad.
  input.addEventListener("input", function () {
    pintarLabel(input.value);
    localStorage.setItem(claveIntensidad, input.value);
    reaplicarAccesibilidad();
  });
}

function iniciarNotificacionesPush() {
  const boton = document.getElementById("pcBtnActivarPush");
  const textoEstado = document.getElementById("pcTextoEstadoPush");
  if (!boton) return;

  function mostrarEstado(texto) {
    if (!textoEstado) return;
    textoEstado.textContent = texto;
    textoEstado.classList.remove("d-none");
  }

  // El botón alterna entre "Activar"/"Desactivar" -- el estado vive en su
  // propio dataset para no tener que volver a preguntarle al backend en
  // cada click. Mismo patrón que preferencias_controller.js en Frontend-PETCORE.
  function pintarBoton(activas) {
    boton.dataset.activas = activas ? "true" : "false";
    if (activas) {
      boton.textContent = "Desactivar";
      boton.classList.replace("btn-primary", "btn-outline-danger");
    } else {
      boton.textContent = "Activar";
      boton.classList.replace("btn-outline-danger", "btn-primary");
    }
  }

  if (!soportaPush()) {
    boton.disabled = true;
    mostrarEstado("Este navegador no soporta notificaciones push.");
    return;
  }

  tieneNotificacionesPushActivas().then(function (activas) {
    pintarBoton(activas);
  });

  boton.addEventListener("click", async function () {
    const activasAhora = boton.dataset.activas === "true";
    const original = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = activasAhora
      ? '<span class="spinner-border spinner-border-sm me-1"></span> Desactivando...'
      : '<span class="spinner-border spinner-border-sm me-1"></span> Activando...';

    const resultado = activasAhora
      ? await desactivarNotificacionesPush()
      : await activarNotificacionesPush();

    boton.disabled = false;

    if (resultado.ok) {
      pintarBoton(!activasAhora);
      mostrarEstado(
        activasAhora
          ? "Notificaciones desactivadas."
          : "Listo -- ya recibirás avisos aunque la app esté cerrada."
      );
    } else {
      boton.innerHTML = original;
      mostrarEstado(resultado.motivo || "No se pudo completar la operación.");
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  iniciarLayout();

  const sesion = requerirSesion();
  if (!sesion) return;

  iniciarSelectorTema(".pc-segmentado-btn", `pc_tema_${sesion.pro_id}`);
  iniciarOpacidadFondo(sesion.pro_id);
  iniciarAnimaciones(sesion.pro_id);
  iniciarDaltonismo(sesion.pro_id);
  iniciarNotificacionesPush();
});
