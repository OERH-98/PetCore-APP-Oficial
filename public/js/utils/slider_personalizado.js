/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/slider_personalizado.js
   Un <input type="range"> nativo no se toca en su comportamiento (teclado,
   arrastre táctil, lector de pantalla) -- solo se le repinta el fondo con
   un gradiente de dos colores que corta justo en --pc-slider-relleno (el %
   ya recorrido, actualizado en cada evento "input"), dando el efecto de
   pista "rellenándose". El resto del look (pista, thumb, foco) vive en
   base_style.css bajo la clase .pc-slider -- como usa var(--pc-azul) /
   var(--pc-azul-claro), se ve bien en claro y oscuro sin duplicar nada acá
   (esos nombres cambian de valor solos al intercambiar tema_claro.css /
   tema_oscuro.css, ver apariencia_utils.js).
   ========================================================================== */

function actualizarRelleno(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const valor = Number(input.value);
  const porcentaje = max > min ? Math.min(100, Math.max(0, ((valor - min) / (max - min)) * 100)) : 0;
  input.style.setProperty("--pc-slider-relleno", `${porcentaje}%`);
}

export function crearSliderPersonalizado(input) {
  if (!input || input.dataset.sliderPersonalizadoListo === "1") return null;
  input.dataset.sliderPersonalizadoListo = "1";

  input.classList.remove("form-range");
  input.classList.add("pc-slider");
  actualizarRelleno(input);

  // "input" cubre arrastre táctil/mouse y las flechas del teclado -- se
  // repinta el relleno en cada tick, no solo al soltar.
  input.addEventListener("input", () => actualizarRelleno(input));

  return {
    // Llamar después de cambiar el .value por código (p. ej. al precargar
    // la preferencia guardada), ya que eso no dispara "input".
    refrescar() { actualizarRelleno(input); }
  };
}
