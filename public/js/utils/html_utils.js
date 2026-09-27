/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/html_utils.js
   Escapa texto antes de interpolarlo en innerHTML/insertAdjacentHTML. Usa el
   propio navegador para escapar (asigna a textContent y lee de vuelta
   innerHTML) en vez de un reemplazo manual de caracteres, así nunca queda
   desincronizado con lo que el navegador considera peligroso.

   Mismo patrón que ya usaba selector_personalizado.js de forma local (sin
   exportarlo); se centraliza aquí para que dashboard_controller.js,
   citas_controller.js, mascota_detalle_controller.js,
   notificaciones_controller.js y formato_utils.js (badge/retrato) lo usen
   de la misma forma en vez de armar HTML por concatenación sin escapar.
   ========================================================================== */
export function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}
