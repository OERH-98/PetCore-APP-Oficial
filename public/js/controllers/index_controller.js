/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/index_controller.js
   Controller de index.html. Ya no es una bienvenida genérica con botón:
   como en el index del frontend de escritorio, es una pantalla de carga que
   decide sola a dónde ir -- si ya hay sesión guardada (pc_sesion), directo
   al dashboard; si no, al login.
   ========================================================================== */
import { obtenerSesion } from "./utils.js";
import { pedirPermisoPushNativo } from "../utils/push_fcm_utils.js";

const TIEMPO_MINIMO_MS = 1200;

document.addEventListener("DOMContentLoaded", function () {
  // Al ARRANCAR la app (no escondido varias pantallas después) -- solo pide
  // el permiso del sistema, no registra nada todavía (eso necesita sesión,
  // ver dashboard_controller.js). No-op fuera de la app nativa / si ya se
  // preguntó antes.
  pedirPermisoPushNativo();

  window.setTimeout(function () {
    window.location.href = obtenerSesion() ? "pages/dashboard.html" : "pages/login.html";
  }, TIEMPO_MINIMO_MS);
});
