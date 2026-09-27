/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/utils.js
   Punto de entrada único que ya usan los controllers ("./utils.js"): la
   lógica en sí vive repartida en js/utils/ (fechas y plantillas, sesión,
   apariencia, notificaciones, avisos con SweetAlert2 -- igual que en el
   frontend de escritorio, donde esas piezas repetidas también viven en su
   propia carpeta js/utils/). Este archivo solo reexporta todo eso y suma
   lo que de verdad es específico de layout (nav inferior, cerrar sesión,
   iniciarLayout), para no tener que tocar el import de cada controller.
   ========================================================================== */
export * from "../utils/formato_utils.js";
export * from "../utils/sesion_utils.js";
export * from "../utils/apariencia_utils.js";
export * from "../utils/notificaciones_utils.js";
export * from "../utils/alertas_utils.js";
export * from "../utils/html_utils.js";

import { cerrarSesion } from "../utils/sesion_utils.js";
import { aplicarFondoInstitucional, refrescarFondoInstitucional } from "../utils/apariencia_utils.js";
import { actualizarBadgeNotificaciones } from "../utils/notificaciones_utils.js";

/* ========================================================================
   LAYOUT COMÚN — nav inferior y botón(es) de cerrar sesión
   ======================================================================== */
export function iniciarBottomNav() {
  const nav = document.getElementById("pcBottomNav");
  if (!nav) return;

  const archivo = window.location.pathname.split("/").pop() || "dashboard.html";

  nav.querySelectorAll(".pc-bottomnav-item").forEach(function (item) {
    const destino = item.getAttribute("href");

    if (destino === archivo) {
      item.classList.add("active");
      item.setAttribute("aria-current", "page");
    }

    item.addEventListener("click", function (evento) {
      if (destino === archivo) {
        evento.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      evento.preventDefault();
      nav.querySelectorAll(".pc-bottomnav-item").forEach(function (otro) {
        otro.classList.remove("active");
      });
      item.classList.add("active");
      window.location.href = destino;
    });
  });
}

export function iniciarCerrarSesion() {
  document.querySelectorAll("[data-pc-salir]").forEach(function (boton) {
    boton.addEventListener("click", function (evento) {
      evento.preventDefault();
      cerrarSesion().then(function () {
        window.location.href = "login.html";
      });
    });
  });
}

/* Arranque común a casi todas las páginas internas (todo menos login.html) */
export function iniciarLayout() {
  iniciarBottomNav();
  iniciarCerrarSesion();
  aplicarFondoInstitucional();
  actualizarBadgeNotificaciones();

  // Conexión al WebSocket compartido (ver websocket_service.js): una vez
  // por página, para que quien quiera suscribirse a un evento (dashboard,
  // citas, notificaciones) ya la tenga lista sin manejarla ella misma. El
  // badge de "Notificaciones" se suscribe aquí mismo para las 5 pestañas: así se
  // actualiza en tiempo real sin importar en qué página esté el
  // propietario cuando se cree/edite/cambie de estado una cita suya.
  import("../services/websocket_service.js").then(function (ws) {
    ws.conectar();
    ws.suscribir("CITA_ACTUALIZADA", actualizarBadgeNotificaciones);
    // El Admin cambia la imagen institucional / su interruptor "mostrarla"
    // desde Config del Sistema en el frontend de escritorio -- sin esto, el
    // fondo aquí se quedaba con el valor cacheado en sessionStorage hasta
    // que el propietario cerraba y abría una pestaña nueva.
    ws.suscribir("CONFIG_SISTEMA_ACTUALIZADA", refrescarFondoInstitucional);
  });
}
