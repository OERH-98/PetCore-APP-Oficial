/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/apariencia_utils.js
   Todo lo que decide Preferencias > Apariencia (y el toggle propio de
   login.html, que comparte la misma función aplicarTema): tema claro/
   oscuro/sistema y la imagen institucional de fondo.
   ========================================================================== */
import { obtenerSesion } from "./sesion_utils.js";

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
    // Android viejo (comprobado en un Samsung J7 Prime, Android 8): las
    // llamadas al plugin StatusBar ahí NO arreglan nada -- rompen el color
    // fijo correcto que ya deja puesto el tema nativo estático (ver
    // android:statusBarColor/windowLightStatusBar en styles.xml). Ahí no se
    // toca nada por JS: se queda con el azul institucional fijo siempre,
    // que es peor que "perfecto" pero mucho mejor que roto/blanco.
    const version = Number((navigator.userAgent.match(/Android\s+(\d+)/) || [])[1]);
    if (version && version < 12) return;

    if (!window.Capacitor?.isNativePlatform?.()) return;
    const StatusBar = window.Capacitor.Plugins?.StatusBar || window.Capacitor.registerPlugin?.("StatusBar");
    if (!StatusBar) return;

    // ".pc-con-header" = pantallas con el header azul fijo (dashboard,
    // citas, Preferencias...) -- ahí los íconos se quedan siempre claros,
    // sin importar el tema. Login/index no tienen ese header (fondo
    // --pc-fondo), así que ahí sí siguen el tema.
    const esPantallaConHeaderAzul = document.body.classList.contains("pc-con-header");
    const estiloIconos = (esPantallaConHeaderAzul || esOscuro) ? "DARK" : "LIGHT";

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

/* Solo lo que pinta el fondo institucional es lo único que se deja en
   sessionStorage; el resto de la configuración (ej. sis_id_emp, el
   empleado que la guardó) nunca se cachea. */
function soloCamposVisuales(config) {
  return {
    sis_img_fondo_url: config.sis_img_fondo_url ?? null,
    sis_mostrar_imagen_sistema: config.sis_mostrar_imagen_sistema ?? null
  };
}

async function obtenerConfiguracionSistemaActual() {
  const cacheado = window.sessionStorage.getItem(CLAVE_CACHE_CFG_SISTEMA);
  if (cacheado) {
    try {
      const visual = soloCamposVisuales(JSON.parse(cacheado));
      // Reescribe: pisa cualquier caché viejo con la configuración completa.
      window.sessionStorage.setItem(CLAVE_CACHE_CFG_SISTEMA, JSON.stringify(visual));
      return visual;
    } catch (e) { /* caché corrupto, se reintenta abajo */ }
  }
  try {
    const { obtenerConfiguracionActual } = await import("../services/config_sistema_service.js");
    const actual = await obtenerConfiguracionActual();
    if (!actual) return null;
    const visual = soloCamposVisuales(actual);
    window.sessionStorage.setItem(CLAVE_CACHE_CFG_SISTEMA, JSON.stringify(visual));
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

export async function aplicarFondoInstitucional() {
  const sesion = obtenerSesion();
  if (!sesion || !sesion.pro_id) return;

  const config = await obtenerConfiguracionSistemaActual();
  if (!config) return;

  const hayFondoActivo = config.sis_img_fondo_url && Number(config.sis_mostrar_imagen_sistema) === 1;
  if (hayFondoActivo) {
    document.documentElement.style.setProperty("--pc-institucional-imagen", `url("${config.sis_img_fondo_url}")`);
    document.body.classList.add("pc-fondo-institucional-activo");
    aplicarOpacidadFondoInstitucional(sesion.pro_id);
  } else {
    document.body.classList.remove("pc-fondo-institucional-activo");
    document.documentElement.style.removeProperty("--pc-institucional-imagen");
  }
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
    window.sessionStorage.setItem(CLAVE_CACHE_CFG_SISTEMA, JSON.stringify(soloCamposVisuales(configNuevo)));
  } else {
    window.sessionStorage.removeItem(CLAVE_CACHE_CFG_SISTEMA);
  }
  return aplicarFondoInstitucional();
}
