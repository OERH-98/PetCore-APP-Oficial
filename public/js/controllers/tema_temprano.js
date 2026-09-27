/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/tema_temprano.js
   Aplica, ANTES del primer render, todo lo que depende de Preferencias >
   Apariencia/Accesibilidad para el propietario logueado: tema (claro/
   oscuro/sistema, como un swap real de hoja de estilo -- ver
   css/tema_claro.css y css/tema_oscuro.css), filtro de daltonismo y
   desactivar animaciones. Por eso es un script clásico (no type="module":
   esos se difieren hasta después de parsear el HTML), cargado al inicio
   del <head>, y usa document.write para no dejar parpadear el tema
   equivocado ni un instante (mismo truco que ya usa el frontend de
   escritorio en cargador_preferencias_admin_controller.js).

   Si todavía no hay sesión, no hay nada que personalizar: se escribe el
   tema claro por defecto y ya (el propio requerirSesion() del controller
   de la página redirige al login enseguida).
   ========================================================================== */
(function () {
  // El pro_id ya NO se lee de ningún almacenamiento del navegador: se le
  // pregunta al backend (que lo saca de la cookie httpOnly) a través de
  // services/sesion_temprana_service.js -- la llamada a la API vive en el
  // service, no acá. Es síncrona porque el tema se decide antes del primer
  // render.
  function sesionActual() {
    var me = window.SesionTempranaService ? window.SesionTempranaService.verificarSesionSync() : null;
    return me && me.authenticated && me.tipo === "PROPIETARIO" ? { pro_id: me.id } : null;
  }

  var sesion = sesionActual();
  var proId = sesion && sesion.pro_id;

  /* -------------------------------------------------------------------
     1. TEMA: swap real de <link> (no solo una variable CSS), para poder
        editar cada paleta en su propio archivo.
     ------------------------------------------------------------------- */
  var guardadoTema = proId ? window.localStorage.getItem("pc_tema_" + proId) : null;
  var prefiereOscuro = false;
  try { prefiereOscuro = window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { /* sin soporte: se queda claro */ }
  var esOscuro = guardadoTema === "oscuro" || (guardadoTema !== "claro" && prefiereOscuro);

  var scriptActual = document.currentScript;
  var rutaScript = (scriptActual && scriptActual.getAttribute("src")) || "js/controllers/tema_temprano.js";
  var base = rutaScript.replace(/js\/controllers\/[^/]+$/, "");
  var rutaTema = base + "css/" + (esOscuro ? "tema_oscuro.css" : "tema_claro.css");

  document.write('<link rel="stylesheet" id="CSS_TEMA" href="' + rutaTema + '">');
  document.documentElement.setAttribute("data-theme", esOscuro ? "dark" : "light");

  /* -------------------------------------------------------------------
     2. ACCESIBILIDAD: filtro de daltonismo (con intensidad) y animaciones
        desactivadas -- se aplican con las mismas matrices que el frontend
        de escritorio.
     ------------------------------------------------------------------- */
  var MATRICES_DALTONISMO = {
    protanopia:   [0.5, 0, 0.5, 0, 0,  0, 1, 0, 0, 0,  0, 0, 1, 0, 0,  0, 0, 0, 1, 0],
    deuteranopia: [1, 0, 0, 0, 0,  0.5, 0, 0.5, 0, 0,  0, 0, 1, 0, 0,  0, 0, 0, 1, 0],
    tritanopia:   [1, 0, 0, 0, 0,  0, 1, 0, 0, 0,  0, 0.5, 0.5, 0, 0,  0, 0, 0, 1, 0]
  };
  var MATRIZ_IDENTIDAD = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

  // Sin esto, cada tick del slider de intensidad (o cambiar el tipo de
  // filtro) pisaba "values" del feColorMatrix de golpe -- un cambio de
  // atributo SVG no es interpolable con transition CSS, así que se anima
  // a mano con requestAnimationFrame, cuadro a cuadro entre la matriz que
  // ya estaba pintada y la nueva. Se cancela la animación anterior si
  // llega un valor nuevo a mitad de camino (arrastre rápido) para que no
  // se acumulen cuadros compitiendo por el mismo atributo. Mismo mecanismo
  // que cargador_preferencias_<rol>_controller.js en el frontend de escritorio.
  var animacionMatrizId = null;
  function aplicarMatrizSuave(feColorMatrix, matrizNuevaStr) {
    var prefiereReducido = false;
    try { prefiereReducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* sin soporte: se anima igual */ }
    if (prefiereReducido) {
      feColorMatrix.setAttribute("values", matrizNuevaStr);
      return;
    }

    var hasta = matrizNuevaStr.split(",").map(Number);
    var actual = feColorMatrix.getAttribute("values");
    var desde = actual ? actual.split(",").map(Number) : hasta;

    if (animacionMatrizId) cancelAnimationFrame(animacionMatrizId);
    var duracion = 150;
    var inicio = performance.now();

    function paso(ahora) {
      var t = Math.min(1, (ahora - inicio) / duracion);
      var interpolada = desde.map(function (valor, i) { return valor + t * (hasta[i] - valor); });
      feColorMatrix.setAttribute("values", interpolada.join(", "));
      animacionMatrizId = t < 1 ? requestAnimationFrame(paso) : null;
    }
    animacionMatrizId = requestAnimationFrame(paso);
  }

  function matrizDaltonismoActual() {
    var id = (sesionActual() || {}).pro_id;
    if (!id) return null;
    var tipo = window.localStorage.getItem("pc_daltonismo_" + id) || "ninguno";
    var base = MATRICES_DALTONISMO[tipo];
    if (!base) return null;
    var guardada = window.localStorage.getItem("pc_daltonismo_intensidad_" + id);
    var intensidad = guardada !== null ? Number(guardada) : 100;
    var t = Math.max(0, Math.min(1, intensidad / 100));
    return base.map(function (valor, i) { return MATRIZ_IDENTIDAD[i] + t * (valor - MATRIZ_IDENTIDAD[i]); }).join(", ");
  }

  function cssAccesibilidadActual() {
    var id = (sesionActual() || {}).pro_id;
    var css = "";
    if (id && window.localStorage.getItem("pc_animaciones_" + id) === "false") {
      css += ".animate__animated{ animation: none !important; transition: none !important; }";
    }
    css += matrizDaltonismoActual()
      ? "html{ filter: url(#filtro-daltonismo-dinamico) !important; }"
      : "html{ filter: none; }";
    return css;
  }

  window.aplicarAccesibilidadEnTiempoReal = function () {
    var estilo = document.getElementById("ESTILO_ACCESIBILIDAD_DINAMICO");
    if (!estilo) {
      estilo = document.createElement("style");
      estilo.id = "ESTILO_ACCESIBILIDAD_DINAMICO";
      document.head.appendChild(estilo);
    }
    estilo.textContent = cssAccesibilidadActual();

    var matriz = matrizDaltonismoActual();
    if (!matriz) return;
    var filtro = document.getElementById("filtro-daltonismo-dinamico");
    if (filtro) {
      aplicarMatrizSuave(filtro.querySelector("feColorMatrix"), matriz);
    } else if (document.body) {
      document.body.insertAdjacentHTML("beforeend",
        '<svg id="SVG_DALTONISMO" style="display:none;width:0;height:0;">' +
          '<defs><filter id="filtro-daltonismo-dinamico">' +
            '<feColorMatrix type="matrix" values="' + matriz + '" />' +
          "</filter></defs>" +
        "</svg>");
    }
  };

  // Primera pintura: mismo contenido, escrito con document.write para que
  // no haya parpadeo (igual que el tema).
  document.write('<style id="ESTILO_ACCESIBILIDAD_DINAMICO">' + cssAccesibilidadActual() + "</style>");

  var matrizInicial = matrizDaltonismoActual();
  if (matrizInicial) {
    window.addEventListener("DOMContentLoaded", function () {
      if (document.getElementById("filtro-daltonismo-dinamico")) return;
      document.body.insertAdjacentHTML("beforeend",
        '<svg id="SVG_DALTONISMO" style="display:none;width:0;height:0;">' +
          '<defs><filter id="filtro-daltonismo-dinamico">' +
            '<feColorMatrix type="matrix" values="' + matrizInicial + '" />' +
          "</filter></defs>" +
        "</svg>");
    });
  }
})();
