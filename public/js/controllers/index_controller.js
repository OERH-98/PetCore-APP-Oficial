/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/index_controller.js
   Controller de index.html. Ya no es una bienvenida genérica con botón:
   como en el index del frontend de escritorio, es una pantalla de carga que
   decide sola a dónde ir -- si ya hay sesión guardada (pc_sesion), directo
   al dashboard; si no, al login.
   ========================================================================== */
import { obtenerSesion } from "./utils.js";

const TIEMPO_MINIMO_MS = 1200;

document.addEventListener("DOMContentLoaded", function () {
  window.setTimeout(function () {
    window.location.href = obtenerSesion() ? "pages/dashboard.html" : "pages/login.html";
  }, TIEMPO_MINIMO_MS);
});
