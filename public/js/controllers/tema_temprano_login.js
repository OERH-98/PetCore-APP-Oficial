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
})();
