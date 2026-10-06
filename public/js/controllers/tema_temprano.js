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

  // Último propietario conocido en ESTE dispositivo. La consulta de arriba es una petición de red (síncrona) y
  // puede fallar un instante (servidor dormido/ocupado, 503, sin señal): sin esto, el tema y la accesibilidad
  // guardados no se encontraban y la app caía al tema del sistema, "ignorando" el modo oscuro elegido. Si la
  // consulta responde, se actualiza; si no, se reutiliza el último (la página igual redirige al login si de
  // verdad no hay sesión). Solo es un id numérico para leer preferencias cosméticas, no da ningún acceso.
  try {
    if (proId) window.localStorage.setItem("pc_ultimo_pro_id", String(proId));
    else proId = window.localStorage.getItem("pc_ultimo_pro_id") || null;
  } catch (e) { /* sin localStorage: se queda como estaba */ }

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

  // A diferencia de login/index (ver tema_temprano_login.js), estas páginas
  // SIEMPRE tienen el header azul fijo arriba (.pc-header, var(--pc-azul)) --
  // los íconos de la barra de estado se quedan claros sin importar el tema,
  // pero el COLOR de la barra sí sigue al header (azul de la marca en claro,
  // azul brillante en oscuro) para que se vea como una sola pieza.
  // Plugin nativo propio (FondoVentanaPlugin.java): en Android viejo el color de StatusBar.setBackgroundColor no se
  // dibuja en la franja que Capacitor 8 reserva arriba -- se ve el fondo de la ventana (blanco). Se pinta ese fondo.
  function pintarFondoVentana(color) {
    try {
      var FondoVentana = (window.Capacitor.Plugins && window.Capacitor.Plugins.FondoVentana)
        || (window.Capacitor.registerPlugin && window.Capacitor.registerPlugin("FondoVentana"));
      if (!FondoVentana) return;
      FondoVentana.setColor({ color: color }).catch(function () { /* app sin el plugin nativo */ });
      // Segunda pasada cuando la página ya terminó de cargar: en Android 8.1 SystemBars decide el layout (franja
      // reservada arriba vs. pantalla completa) antes de saber que la página declara viewport-fit=cover y se queda
      // con la franja blanca; volver a pintar el fondo de la ventana ya con la página lista provoca el recálculo
      // correcto (comprobado en el J7 Prime: el WebView pasa de y=48 a y=0 y el header queda bajo la barra).
      var repetir = function () { setTimeout(function () { FondoVentana.setColor({ color: color }).catch(function () {}); }, 350); };
      if (document.readyState === "complete") repetir(); else window.addEventListener("load", repetir);
    } catch (e) { /* no-op */ }
  }

  // Altura real de la barra de estado -> --pc-barra-estado (ver variables_style.css). Solo hace falta en Android viejo,
  // donde env(safe-area-inset-top) vale 0 y el header quedaba bajo la barra de estado.
  function fijarAlturaBarra(StatusBar) {
    try {
      StatusBar.getInfo().then(function (info) {
        if (info && info.height > 0) document.documentElement.style.setProperty("--pc-barra-estado", info.height + "px");
      }).catch(function () {});
    } catch (e) { /* no-op */ }
  }

  function aplicarBarraDeEstado(oscuro) {
    try {
      if (!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) return;
      var StatusBar = (window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar)
        || (window.Capacitor.registerPlugin && window.Capacitor.registerPlugin("StatusBar"));
      if (!StatusBar) return;

      var version = Number((navigator.userAgent.match(/Android\s+(\d+)/) || [])[1]);
      if (version && version < 12) {
        // Android viejo (probado en un Samsung J7 Prime, Android 8.1): sin edge-to-edge. NUNCA overlay=true (ahí el
        // WebView no recibe safe-area y la barra se montaba sobre el header). Se pinta la barra con el MISMO color
        // del header según el tema y se fija el estilo de íconos. Antes aquí no se tocaba nada y el plugin dejaba la
        // barra en su color por defecto (negro) en vez de seguir al tema.
        StatusBar.setOverlaysWebView({ overlay: true });
        var colorBarra = oscuro ? "#5B9BFF" : "#2D60A1";
        StatusBar.setBackgroundColor({ color: colorBarra });
        StatusBar.setStyle({ style: "DARK" });
        pintarFondoVentana(colorBarra);
        fijarAlturaBarra(StatusBar);
        setTimeout(function () { fijarAlturaBarra(StatusBar); }, 400);
        setTimeout(function () { fijarAlturaBarra(StatusBar); }, 1500);
        return;
      }

      // overlaysWebView arranca en false (capacitor.config.json) -- en dispositivos modernos se activa el
      // edge-to-edge real (necesario para notch/isla dinámica).
      StatusBar.setOverlaysWebView({ overlay: true });
      StatusBar.setStyle({ style: "DARK" });
    } catch (e) { /* no-op fuera de la app nativa */ }
  }
  aplicarBarraDeEstado(esOscuro);

  // Tema "sistema": si el usuario cambia el modo claro/oscuro del teléfono con
  // la app abierta, se re-aplica al instante (antes solo se leía al cargar).
  // Con "claro"/"oscuro" fijados no se toca nada.
  try {
    var mqTema = window.matchMedia("(prefers-color-scheme: dark)");
    var alCambiarSistema = function (e) {
      var fijado = proId ? window.localStorage.getItem("pc_tema_" + proId) : null;
      if (fijado === "claro" || fijado === "oscuro") return;
      document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
      var enlace = document.getElementById("CSS_TEMA");
      if (enlace) {
        enlace.href = enlace.href.replace(/tema_(claro|oscuro)\.css(\?.*)?$/, "tema_" + (e.matches ? "oscuro" : "claro") + ".css");
      }
      aplicarBarraDeEstado(e.matches);
    };
    if (mqTema.addEventListener) mqTema.addEventListener("change", alCambiarSistema);
    else if (mqTema.addListener) mqTema.addListener(alCambiarSistema);
  } catch (e) { /* sin soporte: solo se aplica al cargar */ }

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
    var id = proId;
    if (!id) return null;
    var tipo = window.localStorage.getItem("pc_daltonismo_" + id) || "ninguno";
    var base = MATRICES_DALTONISMO[tipo];
    if (!base) return null;
    var guardada = window.localStorage.getItem("pc_daltonismo_intensidad_" + id);
    var intensidad = guardada !== null ? Number(guardada) : 100;
    var t = Math.max(0, Math.min(1, intensidad / 100));
    return base.map(function (valor, i) { return MATRIZ_IDENTIDAD[i] + t * (valor - MATRIZ_IDENTIDAD[i]); }).join(", ");
  }

  /* ALTO CONTRASTE: se apoya en data-theme (claro/oscuro, ya puesto en <html>) para elegir paleta, así funciona con
     los dos temas, y su filtro "contrast()" se ENCADENA con el de daltonismo (url(#...) contrast(...)): los dos
     funcionan a la vez. Sobreescribe las variables --pc-* (todo el diseño las usa) y refuerza bordes y foco. */
  var CSS_ALTO_CONTRASTE =
    'html[data-contraste="alto"][data-theme="light"]{' +
      '--pc-fondo:#FFFFFF;--pc-superficie:#FFFFFF;--pc-texto:#000000;--pc-texto-suave:#2B3340;--pc-texto-fuerte:#000000;' +
      '--pc-borde:#1F2733;--pc-azul:#0B3C8A;--pc-azul-oscuro:#06265A;--pc-azul-claro:#DCE8FA;' +
      '--pc-ok:#0B6B3A;--pc-aviso:#8A4B00;--pc-critico:#A5120B;--bs-border-color:#1F2733;--bs-secondary-color:#2B3340;}' +
    'html[data-contraste="alto"][data-theme="dark"]{' +
      '--pc-fondo:#000000;--pc-superficie:#0A0A0A;--pc-texto:#FFFFFF;--pc-texto-suave:#E6E9ED;--pc-texto-fuerte:#FFFFFF;' +
      '--pc-borde:#FFFFFF;--pc-azul:#7DB2FF;--pc-azul-oscuro:#1C3D6B;--pc-azul-claro:#0F2036;' +
      '--pc-ok:#5BE39A;--pc-aviso:#FFB454;--pc-critico:#FF8A84;--bs-border-color:#FFFFFF;--bs-secondary-color:#E6E9ED;}' +
    'html[data-contraste="alto"] :is(.pc-card,.form-control,.form-select,.pc-select-input,.pc-select-lista,.dropdown-menu,.badge,.alert,.swal2-popup){border:2px solid var(--pc-borde)!important;}' +
    'html[data-contraste="alto"] .pc-meta,html[data-contraste="alto"] .text-secondary,html[data-contraste="alto"] .text-muted{color:var(--pc-texto-suave)!important;opacity:1!important;}' +
    'html[data-contraste="alto"] :is(a,button,input,select,textarea,[tabindex]):focus-visible{outline:3px solid #FFBF00!important;outline-offset:2px!important;}';

  function contrasteActivo() {
    return !!proId && window.localStorage.getItem("pc_contraste_" + proId) === "true";
  }

  function marcarContrasteEnHtml() {
    if (contrasteActivo()) document.documentElement.setAttribute("data-contraste", "alto");
    else document.documentElement.removeAttribute("data-contraste");
  }

  function cssAccesibilidadActual() {
    var id = proId;
    var css = "";
    if (id && window.localStorage.getItem("pc_animaciones_" + id) === "false") {
      css += ".animate__animated{ animation: none !important; transition: none !important; }";
    }
    var filtros = [];
    if (matrizDaltonismoActual()) filtros.push("url(#filtro-daltonismo-dinamico)");
    if (contrasteActivo()) {
      filtros.push("contrast(1.25)");
      css += CSS_ALTO_CONTRASTE;
    }
    css += filtros.length
      ? "html{ filter: " + filtros.join(" ") + " !important; }"
      : "html{ filter: none; }";
    return css;
  }

  window.aplicarAccesibilidadEnTiempoReal = function () {
    // Si al cargar no se pudo saber el propietario (consulta de red fallida), se reintenta con el último conocido
    // (lo anota sesion_utils.js al verificar la sesión): así cambiar un ajuste en Preferencias surte efecto al instante.
    if (!proId) {
      try { proId = window.localStorage.getItem("pc_ultimo_pro_id") || null; } catch (e) { /* sin localStorage */ }
    }
    marcarContrasteEnHtml();
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
  marcarContrasteEnHtml();
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
