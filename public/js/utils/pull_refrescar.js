/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/pull_refrescar.js
   Deslizar hacia abajo desde el tope de la pantalla para recargarla
   (pull-to-refresh). Recargar la página vuelve a pedir los datos de esa
   pantalla (cada pantalla es su propio documento), así que no necesita
   saber qué hay en cada una.

   No interfiere con el scroll normal: solo arranca si la página está
   exactamente arriba, el dedo baja y no hay un cuadro/lista abierto ni el
   toque empezó dentro de un contenedor con scroll propio o en un campo
   de texto.
   ========================================================================== */
const UMBRAL = 72;      // px de arrastre (ya amortiguado) para que al soltar recargue
const MAXIMO = 110;     // tope visual del arrastre
const AMORTIGUACION = 0.5;

// Cosas que, si están abiertas, hacen que el gesto sea de ellas y no de la página
const SELECTOR_SUPERPUESTOS = ".swal2-container, .modal.show, .offcanvas.show, .pc-fecha-hora-popup.show, .pc-select-lista.show, .pc-visor-pdf";

function scrollActual() {
  const el = document.scrollingElement || document.documentElement;
  return el ? el.scrollTop : (window.scrollY || 0);
}

function dentroDeScrollPropio(destino) {
  for (let el = destino; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (el.nodeType !== 1) continue;
    const estilo = window.getComputedStyle(el);
    const desplazable = /(auto|scroll)/.test(estilo.overflowY) && el.scrollHeight > el.clientHeight;
    if (desplazable && el.scrollTop > 0) return true;   // a medio camino: el gesto es de ese contenedor
    if (el.matches("input, textarea, select, [contenteditable='true']")) return true;
  }
  return false;
}

export function iniciarPullRefrescar() {
  if (window.__pcPullRefrescarActivo) return;
  // Pantallas con formulario (editar perfil, nueva cita, cambiar contraseña): un deslizar accidental perdería lo escrito
  if (document.querySelector("form")) return;
  window.__pcPullRefrescarActivo = true;

  const indicador = document.createElement("div");
  indicador.className = "pc-ptr";
  indicador.setAttribute("aria-hidden", "true");
  indicador.innerHTML = '<i class="fa-solid fa-rotate"></i>';
  document.body.appendChild(indicador);

  let inicioY = null;
  let distancia = 0;
  let recargando = false;

  function topBase() {
    // Justo debajo del header fijo (si la pantalla lo tiene)
    const header = document.querySelector(".pc-header");
    return header ? header.getBoundingClientRect().bottom : 0;
  }

  function pintar(d, listo) {
    const progreso = Math.min(1, d / UMBRAL);
    indicador.style.setProperty("--pc-ptr-y", (topBase() + d - 44) + "px");
    indicador.style.setProperty("--pc-ptr-giro", (progreso * 270) + "deg");
    indicador.classList.add("pc-ptr--visible");
    indicador.classList.toggle("pc-ptr--listo", !!listo);
  }

  function ocultar() {
    indicador.classList.remove("pc-ptr--visible", "pc-ptr--listo", "pc-ptr--girando");
    inicioY = null;
    distancia = 0;
  }

  document.addEventListener("touchstart", function (e) {
    inicioY = null;
    if (recargando || e.touches.length !== 1) return;
    if (scrollActual() > 0) return;
    if (document.querySelector(SELECTOR_SUPERPUESTOS)) return;
    if (dentroDeScrollPropio(e.target)) return;
    inicioY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener("touchmove", function (e) {
    if (inicioY === null || recargando) return;
    const dy = e.touches[0].clientY - inicioY;
    // Subió, o la página ya no está arriba: es scroll normal
    if (dy <= 0 || scrollActual() > 0) { ocultar(); return; }
    distancia = Math.min(MAXIMO, dy * AMORTIGUACION);
    pintar(distancia, distancia >= UMBRAL);
  }, { passive: true });

  function soltar() {
    if (inicioY === null) return;
    if (distancia >= UMBRAL && !recargando) {
      recargando = true;
      indicador.style.setProperty("--pc-ptr-y", (topBase() + UMBRAL * 0.6) + "px");
      indicador.classList.add("pc-ptr--visible", "pc-ptr--listo", "pc-ptr--girando");
      console.log("[PTR] Recargando pantalla por gesto de deslizar hacia abajo");
      window.location.reload();
      return;
    }
    ocultar();
  }
  document.addEventListener("touchend", soltar, { passive: true });
  document.addEventListener("touchcancel", ocultar, { passive: true });
}
