/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/notificaciones_controller.js
   Antes armaba un feed sintético diffando citas/vacunas/antiparasitarios/
   diagnósticos contra un registro "ya visto" guardado en localStorage (ver
   js/utils/notificaciones_utils.js) -- nunca sincronizaba entre dos
   dispositivos del mismo propietario. Ahora TBL_NOTIFICACION_DESTINATARIO
   acepta propietarios además de empleados, así que esta página hace un
   solo fetch a js/services/notificaciones_service.js y el backend es la
   fuente de verdad del leído/no-leído.

   Pestañas "No leídas" / "Leídas" + modal de detalle al tocar una
   notificación: mismo patrón que ya usa la campanita de PC (ver
   estructura_base_controller.js), para que ambos frontends se sientan
   consistentes. "Leídas" se carga perezosamente (recién la primera vez que
   se abre esa pestaña, o de nuevo si quedó desactualizada por marcar algo
   como leído), igual que allá.

   Se mantiene en tiempo real: se suscribe a "NOTIFICACION_NUEVA" (ver
   websocket_service.js / EventoWebSocketHandler en el backend) y vuelve a
   pedir la lista cada vez que llega una notificación nueva -- sin que el
   propietario tenga que recargar la página.
   ========================================================================== */
import {
  iniciarLayout, requerirSesion, pintarBadgeNotificaciones,
  vacio, error as vacioError, quitarEsqueleto, escaparHtml, alertar
} from "./utils.js";
import { obtenerNoLeidasPorPropietario, obtenerLeidasPorPropietario, marcarComoLeida } from "../services/notificaciones_service.js";

// Mapea el código guardado en NOT_ENLACE (ver *Service.java en el backend,
// ej. CitasService/DiagnosticoExpedienteService/HospitalizacionService) a
// dónde debería aterrizar el propietario dentro del portal móvil. La
// notificación no trae el id de la mascota/cita puntual, así que el
// destino es la página de esa categoría, no el detalle exacto.
const DESTINO_POR_ENLACE = {
  CITAS: { href: "citas.html", icono: "fa-solid fa-calendar-check" },
  EXPEDIENTE: { href: "mascotas.html", icono: "fa-solid fa-notes-medical" },
  HOSPITALIZACION: { href: "mascotas.html", icono: "fa-solid fa-heart-pulse" }
};

const CLASE_POR_PRIORIDAD = {
  Urgente: "pc-noti-critico",
  Alta: "pc-noti-critico",
  Normal: "pc-noti-info",
  Baja: "pc-noti-info"
};

function tarjetaNotificacion(n, leida) {
  const destino = DESTINO_POR_ENLACE[n.enlaceNotificacion] || { icono: "fa-regular fa-bell" };
  const clase = CLASE_POR_PRIORIDAD[n.prioridadNotificacion] || "pc-noti-info";

  return (
    '<button type="button" class="pc-card pc-card-pulsable p-3 d-flex gap-3 align-items-center w-100 text-start mb-2 animate__animated animate__fadeIn animate__faster" ' +
       'data-nod-id="' + n.nod_id + '">' +
      '<div class="pc-noti-icono ' + clase + '"><i class="' + destino.icono + '"></i></div>' +
      '<div class="flex-grow-1 min-w-0">' +
        '<div class="d-flex align-items-center gap-2 mb-1">' +
          (leida ? "" : '<span class="pc-noti-punto-nuevo" title="Nueva"></span>') +
          '<p class="pc-registro-titulo mb-0">' + escaparHtml(n.tituloNotificacion) + "</p>" +
        "</div>" +
        '<p class="pc-meta mb-0">' + escaparHtml(n.mensajeNotificacion) + "</p>" +
      "</div>" +
      '<i class="fa-solid fa-chevron-right text-secondary"></i>' +
    "</button>"
  );
}

// Muestra el título y el mensaje COMPLETOS (en la tarjeta el mensaje se
// recorta) en un modal, en vez de saltar directo a la sección de la
// notificación. Si tiene una sección asociada, "Ir a la sección" queda
// como una acción explícita dentro del modal, no como efecto automático
// de tocar la tarjeta -- mismo criterio que la campanita de PC.
function mostrarDetalleNotificacion(notificacion) {
  const destino = DESTINO_POR_ENLACE[notificacion.enlaceNotificacion];
  const fechaCompleta = notificacion.fechaEnvioNotificacion
    ? new Date(notificacion.fechaEnvioNotificacion).toLocaleString("es-SV", {
        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
      })
    : "";

  alertar({
    icon: "info",
    title: notificacion.tituloNotificacion || "Notificación",
    html:
      '<p class="text-start mb-2" style="white-space:pre-wrap;">' + escaparHtml(notificacion.mensajeNotificacion || "") + "</p>" +
      (fechaCompleta ? '<p class="text-start text-muted small mb-0">' + escaparHtml(fechaCompleta) + "</p>" : ""),
    showCancelButton: !!destino,
    confirmButtonText: destino ? "Ir a la sección" : "Cerrar",
    cancelButtonText: "Cerrar"
  }).then(function (resultado) {
    if (destino && resultado.isConfirmed) {
      window.location.href = destino.href;
    }
  });
}

async function cargarNoLeidas(sesion) {
  const lista = document.getElementById("pcListaNotificaciones");
  const subtitulo = document.getElementById("pcNotiSubtitulo");
  if (!lista) return [];

  let notificaciones = [];
  try {
    notificaciones = await obtenerNoLeidasPorPropietario(sesion.pro_id);
  } catch (e) {
    lista.innerHTML = vacioError("No se pudo conectar con el servidor. Intenta más tarde.");
    if (subtitulo) { subtitulo.textContent = ""; quitarEsqueleto(subtitulo); }
    return [];
  }

  pintarSubtituloNoLeidas(notificaciones.length);

  lista.innerHTML = notificaciones.length
    ? notificaciones.map(function (n) { return tarjetaNotificacion(n, false); }).join("")
    : vacio("No tienes notificaciones nuevas. Cuando haya novedades de tus mascotas, aparecerán aquí.");

  pintarBadgeNotificaciones(notificaciones.length);

  return notificaciones;
}

function pintarSubtituloNoLeidas(cantidad) {
  const subtitulo = document.getElementById("pcNotiSubtitulo");
  if (!subtitulo) return;
  subtitulo.textContent = cantidad
    ? cantidad + (cantidad === 1 ? " notificación nueva" : " notificaciones nuevas")
    : "Estás al día.";
  quitarEsqueleto(subtitulo);
}

async function cargarLeidas(sesion) {
  const lista = document.getElementById("pcListaLeidas");
  if (!lista) return [];

  let notificaciones = [];
  try {
    notificaciones = await obtenerLeidasPorPropietario(sesion.pro_id);
  } catch (e) {
    lista.innerHTML = vacioError("No se pudo conectar con el servidor. Intenta más tarde.");
    return [];
  }

  lista.innerHTML = notificaciones.length
    ? notificaciones.map(function (n) { return tarjetaNotificacion(n, true); }).join("")
    : vacio("Todavía no tienes notificaciones leídas.");

  return notificaciones;
}

document.addEventListener("DOMContentLoaded", function () {
  iniciarLayout();

  const sesion = requerirSesion();
  if (!sesion) return;

  let noLeidasActuales = [];
  let leidasActuales = [];
  let leidasDesactualizadas = true;

  cargarNoLeidas(sesion).then(function (n) { noLeidasActuales = n; });

  // Tocar una notificación de "No leídas": la marca como leída de una vez
  // en la propia lista (no espera la confirmación del servidor -- si falla,
  // sigue apareciendo como no leída la próxima vez) y muestra su detalle
  // completo en un modal.
  const listaNoLeidas = document.getElementById("pcListaNotificaciones");
  if (listaNoLeidas) {
    listaNoLeidas.addEventListener("click", function (evento) {
      const tarjeta = evento.target.closest("[data-nod-id]");
      if (!tarjeta) return;

      const nodId = Number(tarjeta.dataset.nodId);
      const notificacion = noLeidasActuales.find(function (n) { return n.nod_id === nodId; });
      if (!notificacion) return;

      noLeidasActuales = noLeidasActuales.filter(function (n) { return n.nod_id !== nodId; });
      leidasDesactualizadas = true;
      tarjeta.remove();
      if (!noLeidasActuales.length) {
        listaNoLeidas.innerHTML = vacio("No tienes notificaciones nuevas. Cuando haya novedades de tus mascotas, aparecerán aquí.");
      }
      pintarSubtituloNoLeidas(noLeidasActuales.length);
      pintarBadgeNotificaciones(noLeidasActuales.length);

      mostrarDetalleNotificacion(notificacion);

      marcarComoLeida(notificacion).catch(function (e) {
        console.warn("No se pudo marcar la notificación como leída:", e);
      });
    });
  }

  // Pestaña "Leídas": solo muestra el detalle, ya no hay nada que marcar.
  const listaLeidas = document.getElementById("pcListaLeidas");
  if (listaLeidas) {
    listaLeidas.addEventListener("click", function (evento) {
      const tarjeta = evento.target.closest("[data-nod-id]");
      if (!tarjeta) return;

      const nodId = Number(tarjeta.dataset.nodId);
      const notificacion = leidasActuales.find(function (n) { return n.nod_id === nodId; });
      if (notificacion) mostrarDetalleNotificacion(notificacion);
    });
  }

  // Carga perezosa: recién pide el historial de leídas la primera vez que
  // se abre esa pestaña, o de nuevo si quedó desactualizada.
  const tabLeidas = document.getElementById("pcTabLeidas");
  if (tabLeidas) {
    tabLeidas.addEventListener("shown.bs.tab", function () {
      if (!leidasDesactualizadas) return;
      cargarLeidas(sesion).then(function (n) {
        leidasActuales = n;
        leidasDesactualizadas = false;
      });
    });
  }

  import("../services/websocket_service.js").then(function (ws) {
    ws.suscribir("NOTIFICACION_NUEVA", function () {
      cargarNoLeidas(sesion).then(function (n) { noLeidasActuales = n; });
    });
  });
});
