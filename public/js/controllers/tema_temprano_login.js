/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/tema_temprano_login.js
   Misma idea que tema_temprano.js (aplicar el tema antes del primer
   render, con un swap real de <link>, como script clásico bloqueante),
   pero para login.html e index.html: son pantallas "fuera de la app" --
   todavía no hay sesión ni pro_id, así que usan su propia preferencia
   global (pc_tema_login) en vez de una por propietario, y no aplican
   accesibilidad (daltonismo/animaciones son preferencias de Preferencias,
   que exige sesión). index.html hereda a propósito esta misma preferencia
   del login, no la de Preferencias, ya que la pantalla de carga se ve
   antes de saber si hay o no sesión.

   Comparte archivo entre index.html (raíz) y login.html (pages/), que
   están a distinta profundidad -- por eso la ruta a css/ se calcula a
   partir de la propia ruta con la que se cargó este script
   (document.currentScript) en vez de estar fija.
   ========================================================================== */
(function () {
  var guardado = null;
  try { guardado = window.localStorage.getItem("pc_tema_login"); } catch (e) { /* localStorage no disponible */ }

  var prefiereOscuro = false;
  try { prefiereOscuro = window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { /* sin soporte: se queda claro */ }

  var esOscuro = guardado === "oscuro" || (guardado !== "claro" && prefiereOscuro);

  var scriptActual = document.currentScript;
  var rutaScript = (scriptActual && scriptActual.getAttribute("src")) || "js/controllers/tema_temprano_login.js";
  var base = rutaScript.replace(/js\/controllers\/[^/]+$/, "");
  var rutaTema = base + "css/" + (esOscuro ? "tema_oscuro.css" : "tema_claro.css");

  document.write('<link rel="stylesheet" id="CSS_TEMA" href="' + rutaTema + '">');
  document.documentElement.setAttribute("data-theme", esOscuro ? "dark" : "light");

  // Login/index NO tienen el header azul de la app (ver tema_temprano.js) --
  // su fondo es --pc-fondo, blanco casi puro en claro y muy oscuro en
  // oscuro, así que acá la barra de estado SÍ debe seguir el tema (íconos
  // oscuros sobre fondo claro, claros sobre fondo oscuro). Sin esto, con el
  // estilo fijo que capacitor.config.json deja como valor inicial, en modo
  // claro los íconos (batería, señal) quedaban blancos sobre fondo blanco --
  // invisibles.
  // Altura real de la barra de estado -> --pc-barra-estado (ver variables_style.css). Solo hace falta en Android viejo,
  // donde env(safe-area-inset-top) vale 0 y el header quedaba bajo la barra de estado.
  function fijarAlturaBarra(StatusBar) {
    try {
      StatusBar.getInfo().then(function (info) {
        if (info && info.height > 0) document.documentElement.style.setProperty("--pc-barra-estado", info.height + "px");
      }).catch(function () {});
    } catch (e) { /* no-op */ }
  }

  function aplicarEstiloBarraDeEstado(oscuro) {
    try {
      if (!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) return;
      var StatusBar = (window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar)
        || (window.Capacitor.registerPlugin && window.Capacitor.registerPlugin("StatusBar"));
      if (!StatusBar) return;

      // Android viejo (probado en un Samsung J7 Prime, Android 8.1): sin edge-to-edge (nunca overlay=true) y la barra
      // con el color del fondo de login/index según el tema, con íconos que contrasten (oscuros sobre claro, claros
      // sobre oscuro). Antes aquí no se hacía nada y la barra quedaba con el color por defecto del plugin.
      var version = Number((navigator.userAgent.match(/Android\s+(\d+)/) || [])[1]);
      if (version && version < 12) {
        StatusBar.setOverlaysWebView({ overlay: true });
        var colorBarra = oscuro ? "#10141B" : "#F4F6FA";
        StatusBar.setBackgroundColor({ color: colorBarra });
        StatusBar.setStyle({ style: oscuro ? "DARK" : "LIGHT" });
        // Plugin nativo propio (FondoVentanaPlugin.java): pinta el fondo de la ventana, que es lo que se ve en la
        // franja de la barra de estado en Android viejo (ver tema_temprano.js).
        var FondoVentana = (window.Capacitor.Plugins && window.Capacitor.Plugins.FondoVentana)
          || (window.Capacitor.registerPlugin && window.Capacitor.registerPlugin("FondoVentana"));
        if (FondoVentana) {
          FondoVentana.setColor({ color: colorBarra }).catch(function () { /* app sin el plugin nativo */ });
          // Segunda pasada cuando la página ya terminó de cargar: en Android 8.1 SystemBars decide el layout (franja
          // reservada arriba vs. pantalla completa) antes de saber que la página declara viewport-fit=cover y se queda
          // con la franja blanca; volver a pintar el fondo de la ventana ya con la página lista provoca el recálculo
          // correcto (comprobado en el J7 Prime: el WebView pasa de y=48 a y=0 y el header queda bajo la barra).
          var repetir = function () { setTimeout(function () { FondoVentana.setColor({ color: colorBarra }).catch(function () {}); }, 350); };
          if (document.readyState === "complete") repetir(); else window.addEventListener("load", repetir);
        }
        fijarAlturaBarra(StatusBar);
        setTimeout(function () { fijarAlturaBarra(StatusBar); }, 400);
        setTimeout(function () { fijarAlturaBarra(StatusBar); }, 1500);
        return;
      }

      // overlaysWebView arranca en false (capacitor.config.json) para que
      // Android viejo nunca lo toque -- acá, en dispositivos modernos, se
      // activa el edge-to-edge real (necesario para notch/isla dinámica).
      StatusBar.setOverlaysWebView({ overlay: true });
      StatusBar.setStyle({ style: oscuro ? "DARK" : "LIGHT" });
    } catch (e) { /* no-op fuera de la app nativa */ }
  }
  aplicarEstiloBarraDeEstado(esOscuro);

  // Tema "sistema": si el usuario cambia el modo claro/oscuro del teléfono con
  // la app abierta, se re-aplica al instante (antes solo se leía al cargar).
  // Con "claro"/"oscuro" fijados no se toca nada.
  try {
    var mqTema = window.matchMedia("(prefers-color-scheme: dark)");
    var alCambiarSistema = function (e) {
      var fijado = (function () { try { return window.localStorage.getItem("pc_tema_login"); } catch (e) { return null; } })();
      if (fijado === "claro" || fijado === "oscuro") return;
      document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
      var enlace = document.getElementById("CSS_TEMA");
      if (enlace) {
        enlace.href = enlace.href.replace(/tema_(claro|oscuro)\.css(\?.*)?$/, "tema_" + (e.matches ? "oscuro" : "claro") + ".css");
      }
      aplicarEstiloBarraDeEstado(e.matches);
    };
    if (mqTema.addEventListener) mqTema.addEventListener("change", alCambiarSistema);
    else if (mqTema.addListener) mqTema.addListener(alCambiarSistema);
  } catch (e) { /* sin soporte: solo se aplica al cargar */ }
})();
