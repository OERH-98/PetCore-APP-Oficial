/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/notificaciones_enlaces_utils.js
   "enlace" en una notificación (NOT_ENLACE en el backend) es un CÓDIGO de
   categoría, no una URL -- este mapa lo traduce a la página real del portal.
   Compartido entre notificaciones_controller.js (la campanita in-app) y
   push_fcm_utils.js (abrir la app desde una notificación push nativa) para
   no tener el mapa duplicado ni repetido en dos lugares.

   Sin id de mascota/cita puntual en la notificación, el destino es la
   página de esa categoría, no el detalle exacto.
   ========================================================================== */
export const DESTINO_POR_ENLACE = {
  CITAS: { href: "citas.html", icono: "fa-solid fa-calendar-check" },
  EXPEDIENTE: { href: "mascotas.html", icono: "fa-solid fa-notes-medical" },
  HOSPITALIZACION: { href: "mascotas.html", icono: "fa-solid fa-heart-pulse" }
};
