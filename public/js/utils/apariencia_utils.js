/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/apariencia_utils.js
   Todo lo que decide Preferencias > Apariencia (y el toggle propio de
   login.html, que comparte la misma función aplicarTema): tema claro/
   oscuro/sistema y la imagen institucional de fondo.
   ========================================================================== */
import { obtenerSesion } from "./sesion_utils.js";
import { obtenerSrcImagenCacheada } from "../services/fondo_cache_service.js";

/* ------------------------------------------------------------------------
   TEMA
   "sistema" no escribe data-theme: lo decide @media (prefers-color-scheme)
   en tema_claro.css/tema_oscuro.css. "claro"/"oscuro" fuerzan el atributo,
   que gana siempre. Ver tema_temprano.js / tema_temprano_login.js para la
   misma lógica aplicada ANTES del primer render (evita el parpadeo).
   ------------------------------------------------------------------------ */
export function aplicarTema(valor) {
  let prefiereOscuro = false;
  try { prefiereOscuro = window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { /* sin soporte: se queda claro */ }
  const esOscuro = valor === "oscuro" || (valor !== "claro" && prefiereOscuro);

  document.documentElement.setAttribute("data-theme", esOscuro ? "dark" : "light");

  // Swap real del archivo de tema (no solo una variable CSS) -- mismo
  // <link id="CSS_TEMA"> que escribió tema_temprano.js / tema_temprano_
  // login.js antes del primer render.
  const link = document.getElementById("CSS_TEMA");
  if (link) {
    link.href = link.href.replace(/tema_(claro|oscuro)\.css(\?.*)?$/, `tema_${esOscuro ? "oscuro" : "claro"}.css`);
  }

  actualizarBarraDeEstadoNativa(esOscuro);
}

/* App nativa (Capacitor): misma lógica que tema_temprano.js / tema_temprano_
   login.js, pero acá cubre el cambio EN VIVO -- tocar los botones de tema en
   pantalla -- que esos dos scripts no alcanzan (solo corren antes del
   primer render, una vez por carga de página). */
function actualizarBarraDeEstadoNativa(esOscuro) {
  try {
    if (!window.Capacitor?.isNativePlatform?.()) return;
    const StatusBar = window.Capacitor.Plugins?.StatusBar || window.Capacitor.registerPlugin?.("StatusBar");
    if (!StatusBar) return;

    // ".pc-con-header" = pantallas con el header azul fijo (dashboard,
    // citas, Preferencias...) -- ahí los íconos se quedan siempre claros,
    // sin importar el tema. Login/index no tienen ese header (fondo
    // --pc-fondo), así que ahí sí siguen el tema.
    const esPantallaConHeaderAzul = document.body.classList.contains("pc-con-header");
    const estiloIconos = (esPantallaConHeaderAzul || esOscuro) ? "DARK" : "LIGHT";

    // Android viejo (Samsung J7 Prime, Android 8.1): sin edge-to-edge. Cada toggle de tema repinta la barra con el
    // color de lo que hay debajo (header azul, o el fondo en login) y el estilo de íconos que contraste.
    const version = Number((navigator.userAgent.match(/Android\s+(\d+)/) || [])[1]);
    if (version && version < 12) {
      const colorBarra = esPantallaConHeaderAzul ? (esOscuro ? "#5B9BFF" : "#2D60A1") : (esOscuro ? "#10141B" : "#F4F6FA");
      StatusBar.setOverlaysWebView({ overlay: true });
      StatusBar.setBackgroundColor({ color: colorBarra });
      StatusBar.setStyle({ style: estiloIconos });
      // Plugin nativo propio (FondoVentanaPlugin.java): en Android viejo la franja de la barra muestra el fondo de la
      // ventana, no el color de StatusBar.setBackgroundColor (ver tema_temprano.js).
      const FondoVentana = window.Capacitor.Plugins?.FondoVentana || window.Capacitor.registerPlugin?.("FondoVentana");
      FondoVentana?.setColor({ color: colorBarra }).catch(() => { /* app sin el plugin nativo */ });
      return;
    }

    // overlaysWebView arranca en false (capacitor.config.json) para que
    // Android viejo nunca lo toque -- acá, en dispositivos modernos, se
    // activa el edge-to-edge real (necesario para notch/isla dinámica).
    // Repetirlo en cada toggle no hace daño (ya lo dejó puesto tema_temprano.js).
    StatusBar.setOverlaysWebView({ overlay: true });
    StatusBar.setStyle({ style: estiloIconos });
  } catch (e) { /* no-op fuera de la app nativa, o API no disponible en esa versión */ }
}

/* Cablea un grupo de botones "Claro/Oscuro/Sistema" (cada uno con
   data-tema="claro|oscuro|sistema") a una clave de localStorage: pinta cuál
   está activo, aplica el tema al elegir uno y lo guarda. Se usa igual en el
   toggle de login.html (pc_tema_login, sin sesión) y en Preferencias >
   Apariencia (pc_tema_<pro_id>, por propietario). */
export function iniciarSelectorTema(selector, clave) {
  const botones = document.querySelectorAll(selector);
  if (!botones.length) return;

  function pintarActivo(valor) {
    botones.forEach(function (boton) {
      boton.setAttribute("aria-pressed", String(boton.dataset.tema === valor));
    });
  }

  const guardado = window.localStorage.getItem(clave) || "sistema";
  pintarActivo(guardado);

  botones.forEach(function (boton) {
    boton.addEventListener("click", function () {
      const valor = boton.dataset.tema;
      window.localStorage.setItem(clave, valor);
      aplicarTema(valor);
      pintarActivo(valor);
    });
  });
}

/* ------------------------------------------------------------------------
   FONDO INSTITUCIONAL
   Imagen configurada por el administrador en el frontend de escritorio
   (Config del Sistema); la opacidad es una preferencia propia de cada
   propietario. Sin imagen configurada, o con "mostrar imagen
   institucional" apagado, no se toca nada.
   ------------------------------------------------------------------------ */
const CLAVE_CACHE_CFG_SISTEMA = "pc_cfg_sistema_cache";
const CLAVE_CFG_REVISADA = "pc_cfg_sistema_revisada";
// Con la configuración ya guardada se pinta al instante y solo se vuelve a preguntar al servidor cada tanto
// (los cambios en vivo del admin llegan igual por WebSocket -> refrescarFondoInstitucional).
const VIGENCIA_REVISION_MS = 10 * 60 * 1000;

/* Solo lo que pinta el fondo institucional se guarda en el dispositivo; el
   resto de la configuración (ej. sis_id_emp, el empleado que la guardó)
   nunca se cachea. localStorage (no sessionStorage): sobrevive al cierre de
   la app, que es justo lo que evita recargar el fondo en cada arranque. */
function soloCamposVisuales(config) {
  return {
    sis_img_fondo_url: config.sis_img_fondo_url ?? null,
    sis_mostrar_imagen_sistema: config.sis_mostrar_imagen_sistema ?? null
  };
}

function leerConfigCacheada() {
  try {
    const texto = window.localStorage.getItem(CLAVE_CACHE_CFG_SISTEMA);
    return texto ? soloCamposVisuales(JSON.parse(texto)) : null;
  } catch (e) { return null; }
}

function guardarConfigCacheada(visual) {
  try {
    window.localStorage.setItem(CLAVE_CACHE_CFG_SISTEMA, JSON.stringify(visual));
    window.localStorage.setItem(CLAVE_CFG_REVISADA, String(Date.now()));
  } catch (e) { /* sin almacenamiento: se pedirá de nuevo */ }
}

function revisionVencida() {
  try {
    return Date.now() - Number(window.localStorage.getItem(CLAVE_CFG_REVISADA) || 0) > VIGENCIA_REVISION_MS;
  } catch (e) { return true; }
}

async function obtenerConfiguracionRemota() {
  try {
    const { obtenerConfiguracionActual } = await import("../services/config_sistema_service.js");
    const actual = await obtenerConfiguracionActual();
    if (!actual) return null;
    const visual = soloCamposVisuales(actual);
    guardarConfigCacheada(visual);
    return visual;
  } catch (e) {
    console.warn("No se pudo obtener la configuración del sistema:", e);
    return null;
  }
}

/* Traduce la preferencia de "opacidad" (0-100, % de visibilidad de la
   imagen) del propietario a la variable CSS que regula el velo. */
export function aplicarOpacidadFondoInstitucional(proId) {
  const guardada = window.localStorage.getItem(`pc_opacidad_fondo_${proId}`);
  const visibilidad = guardada !== null && guardada !== "" ? Number(guardada) : 55;
  const alpha = Math.max(0, Math.min(1, 1 - (visibilidad / 100)));
  document.documentElement.style.setProperty("--pc-institucional-overlay-alpha", String(alpha));
}

// Evita repintar (y releer la imagen guardada) si nada cambió respecto a lo ya aplicado en esta página.
let firmaPintada = null;

async function pintarFondo(config, proId) {
  const firma = JSON.stringify(config) + "|" + proId;
  if (firma === firmaPintada) return;
  firmaPintada = firma;

  const hayFondoActivo = config.sis_img_fondo_url && Number(config.sis_mostrar_imagen_sistema) === 1;
  if (hayFondoActivo) {
    // Desde el almacenamiento del dispositivo si ya está guardada (ver fondo_cache_service.js)
    const src = await obtenerSrcImagenCacheada(config.sis_img_fondo_url);
    document.documentElement.style.setProperty("--pc-institucional-imagen", `url("${src}")`);
    document.body.classList.add("pc-fondo-institucional-activo");
    aplicarOpacidadFondoInstitucional(proId);
  } else {
    document.body.classList.remove("pc-fondo-institucional-activo");
    document.documentElement.style.removeProperty("--pc-institucional-imagen");
  }
}

export async function aplicarFondoInstitucional() {
  let config = leerConfigCacheada();

  // Primer pintado inmediato: con la configuración guardada y el último propietario conocido (el mismo dato que ya
  // usa tema_temprano.js) no hace falta esperar a verificar la sesión contra el servidor para mostrar el fondo.
  let proIdConocido = null;
  try { proIdConocido = window.localStorage.getItem("pc_ultimo_pro_id"); } catch (e) { /* sin localStorage */ }
  if (config && proIdConocido) await pintarFondo(config, proIdConocido);

  const sesion = await obtenerSesion();
  if (!sesion || !sesion.pro_id) return;

  if (!config || revisionVencida()) {
    const remota = await obtenerConfiguracionRemota();
    if (remota) config = remota;
  }
  if (config) await pintarFondo(config, sesion.pro_id);
}

/* Se llama al recibir "CONFIG_SISTEMA_ACTUALIZADA" por WebSocket (ver
   utils.js/iniciarLayout): sin esto, aplicarFondoInstitucional() de arriba
   siempre servía el config guardado en sessionStorage aunque el Admin
   acabara de cambiar la imagen/opacidad desde Config del Sistema en el
   frontend de escritorio -- el propietario solo lo veía hasta que cerraba
   y abría una pestaña nueva (sessionStorage vencía recién ahí).
   El evento ya trae el ConfiguracionSistemaDTO actualizado como payload
   (EventoWebSocketHandler.difundir), así que se puede refrescar el caché
   directo con eso, sin otro viaje de red. */
export function refrescarFondoInstitucional(configNuevo) {
  if (configNuevo) {
    guardarConfigCacheada(soloCamposVisuales(configNuevo));
  } else {
    try { window.localStorage.removeItem(CLAVE_CACHE_CFG_SISTEMA); window.localStorage.removeItem(CLAVE_CFG_REVISADA); } catch (e) { /* nada */ }
  }
  return aplicarFondoInstitucional();
}
