/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/navegacion_atras.js
   "Atrás" del teléfono:
     - Android: botón/gesto atrás (plugin @capacitor/app, evento "backButton").
     - iPhone: no existe botón atrás del sistema -> gesto de deslizar desde el borde izquierdo (aquí) y la
       flecha del encabezado que ya tiene cada pantalla interna. Ambos hacen lo mismo.

   La lógica NO depende del historial del navegador (que se desordena con el login, la barra inferior, etc.): sigue
   la misma de las flechas del encabezado -- cada pantalla interna regresa a la sección previa:
     detalle de mascota -> Mascotas · nueva cita -> Citas · editar perfil / cambiar contraseña / facturas /
     preferencias -> Perfil · detalle de factura -> Facturas.
   Las pestañas de la barra inferior regresan al Inicio, y en el Inicio (o el login) se pide confirmar:
   "Presiona de nuevo para salir" (solo Android puede cerrar la app; en iPhone el Inicio simplemente no hace nada).
   Antes de navegar, "atrás" cierra lo que esté abierto encima (aviso, lista desplegable, modal).
   ========================================================================== */
import { mostrarToast } from "./alertas_utils.js";

const PANTALLA_PREVIA = {
  // Pantallas internas: misma sección a la que apunta su flecha del encabezado
  "mascota_detalle.html": "mascotas.html",
  "nueva_cita.html": "citas.html",
  "editar_perfil.html": "perfil.html",
  "cambiar_contrasena.html": "perfil.html",
  "facturas.html": "perfil.html",
  "factura_detalle.html": "facturas.html",
  "preferencias.html": "perfil.html",
  // Pestañas de la barra inferior -> Inicio
  "mascotas.html": "dashboard.html",
  "citas.html": "dashboard.html",
  "notificaciones.html": "dashboard.html",
  "perfil.html": "dashboard.html",
  // Pantallas sin sesión -> login
  "recuperar_contrasena.html": "login.html",
  "vincular_google.html": "login.html"
};

const ESPERA_CONFIRMAR_SALIR_MS = 2000;
let ultimoAtrasEnRaiz = 0;

function esNativa() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

function plataforma() {
  return window.Capacitor && window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : "web";
}

function pluginApp() {
  if (!window.Capacitor) return null;
  return (window.Capacitor.Plugins && window.Capacitor.Plugins.App)
    || (window.Capacitor.registerPlugin && window.Capacitor.registerPlugin("App"));
}

function archivoActual() {
  return window.location.pathname.split("/").pop() || "dashboard.html";
}

/* Cierra lo que esté abierto encima de la pantalla; devuelve true si había algo (entonces no se navega). */
function cerrarCapaAbierta() {
  if (window.Swal && window.Swal.isVisible && window.Swal.isVisible()) {
    window.Swal.close();
    return true;
  }
  const lista = document.querySelector(".pc-select-lista.show");
  if (lista) {
    lista.classList.remove("show");
    return true;
  }
  const modal = document.querySelector(".modal.show");
  if (modal && window.bootstrap && window.bootstrap.Modal) {
    const instancia = window.bootstrap.Modal.getInstance(modal);
    if (instancia) {
      instancia.hide();
      return true;
    }
  }
  return false;
}

/* Un paso atrás con la lógica de arriba. "puedeSalir" solo es true en Android (iPhone no puede cerrar la app). */
export function volverAtras(puedeSalir) {
  if (cerrarCapaAbierta()) return;

  const previa = PANTALLA_PREVIA[archivoActual()];
  if (previa) {
    // replace: no apila otra entrada en el historial (si no, "atrás" y la flecha irían creciendo el historial)
    window.location.replace(previa);
    return;
  }

  // Pantalla raíz (Inicio o login): confirmar antes de salir
  if (!puedeSalir) return;
  const ahora = Date.now();
  if (ahora - ultimoAtrasEnRaiz < ESPERA_CONFIRMAR_SALIR_MS) {
    const app = pluginApp();
    if (app && app.exitApp) app.exitApp();
    return;
  }
  ultimoAtrasEnRaiz = ahora;
  mostrarToast("info", "Presiona de nuevo para salir");
}

/* Gesto iOS: deslizar hacia la derecha desde el borde izquierdo de la pantalla */
function iniciarGestoBordeIzquierdo() {
  const BORDE_PX = 24;
  const DISTANCIA_MINIMA_PX = 70;
  const DESVIO_VERTICAL_MAXIMO_PX = 60;
  const DURACION_MAXIMA_MS = 800;
  let inicio = null;

  document.addEventListener("touchstart", function (evento) {
    const toque = evento.touches[0];
    inicio = (evento.touches.length === 1 && toque.clientX <= BORDE_PX)
      ? { x: toque.clientX, y: toque.clientY, t: Date.now() }
      : null;
  }, { passive: true });

  document.addEventListener("touchend", function (evento) {
    if (!inicio) return;
    const toque = evento.changedTouches[0];
    const dx = toque.clientX - inicio.x;
    const dy = Math.abs(toque.clientY - inicio.y);
    const dt = Date.now() - inicio.t;
    inicio = null;
    if (dx >= DISTANCIA_MINIMA_PX && dy <= DESVIO_VERTICAL_MAXIMO_PX && dt <= DURACION_MAXIMA_MS) {
      volverAtras(false);
    }
  }, { passive: true });

  document.addEventListener("touchcancel", function () { inicio = null; }, { passive: true });
}

let iniciado = false;

/* Se llama una vez por página (iniciarLayout y las pantallas sin sesión). Solo hace algo en la app nativa. */
export function iniciarNavegacionAtras() {
  if (iniciado || !esNativa()) return;
  iniciado = true;

  if (plataforma() === "android") {
    const app = pluginApp();
    if (app && app.addListener) {
      // Con este listener registrado, Capacitor ya no cierra la app por su cuenta: lo decide volverAtras()
      app.addListener("backButton", function () { volverAtras(true); });
    }
  } else if (plataforma() === "ios") {
    iniciarGestoBordeIzquierdo();
  }
}
