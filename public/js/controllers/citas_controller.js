/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/citas_controller.js
   Controller de pages/citas.html.
   Servicios usados: citas_service.js, mascotas_service.js
   ========================================================================== */
import { obtenerCitasPorPropietario } from "../services/citas_service.js";
import { obtenerMascotasPorPropietario } from "../services/mascotas_service.js";
import {
  iniciarLayout, requerirSesion, esFutura, aFecha, fechaConDia, badge,
  retrato, vacio, soloFecha, nombreEmpleado, error as vacioError, escaparHtml
} from "./utils.js";

// Tiempo mínimo que se deja el esqueleto en pantalla: la API local suele
// responder en unos pocos milisegundos, tan rápido que el shimmer nunca
// alcanza a notarse -- sin este mínimo, en la práctica nunca llega a
// pintarse un frame con él.
const ESPERA_MINIMA_MS = 400;

function esperar(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function iniciarCitas() {
  const proximas = document.getElementById("pcCitasProximas");
  if (!proximas) return;

  const sesion = await requerirSesion();
  if (!sesion) return;

  const anteriores = document.getElementById("pcCitasAnteriores");
  const inicio = Date.now();

  let citas = [];
  let mascotas = [];
  try {
    [citas, mascotas] = await Promise.all([obtenerCitasPorPropietario(sesion.pro_id), obtenerMascotasPorPropietario(sesion.pro_id)]);
    mascotas = mascotas || [];
    citas = citas || [];
    const transcurrido = Date.now() - inicio;
    if (transcurrido < ESPERA_MINIMA_MS) await esperar(ESPERA_MINIMA_MS - transcurrido);
  } catch (e) {
    proximas.innerHTML = vacioError("No se pudo conectar con el servidor. Intenta más tarde.");
    if (anteriores) anteriores.innerHTML = "";
    return;
  }

  function mascotaPorId(id) {
    return mascotas.find(function (m) { return Number(m.mas_id) === Number(id); }) || {};
  }

  function tarjeta(c) {
    const m = mascotaPorId(c.cit_mas_id);
    return (
      '<a class="pc-card pc-card-pulsable p-3 d-flex gap-3 align-items-center mb-2 animate__animated animate__fadeInUp animate__faster" ' +
         'href="mascota_detalle.html?id=' + c.cit_mas_id + '#panelCitas">' +
        retrato(m, "pc-retrato-sm") +
        '<div class="flex-grow-1 min-w-0">' +
          '<p class="pc-registro-titulo mb-1">' + escaparHtml(c.cit_motivo || "") + "</p>" +
          '<p class="pc-meta mb-2">' + escaparHtml(m.mas_nombre || "") + ' · <span class="pc-dato">' + escaparHtml(c.cit_hora_inicio) + "</span> · " + escaparHtml(nombreEmpleado(c)) + "</p>" +
          badge(c.cit_estado) +
          (c.cit_estado === "Agendada" ? ' <span class="pc-meta">Pendiente de aceptar</span>' : "") +
        "</div>" +
        '<i class="fa-solid fa-chevron-right text-secondary"></i>' +
      "</a>"
    );
  }

  function agrupar(lista) {
    let html = "";
    let diaActual = null;
    lista.forEach(function (c) {
      const fecha = soloFecha(c.cit_fecha_cita);
      if (fecha !== diaActual) {
        diaActual = fecha;
        html += '<div class="pc-separador-dia"><span>' + fechaConDia(fecha) + "</span></div>";
      }
      html += tarjeta(c);
    });
    return html;
  }

  const futuras = citas.filter(function (c) { return esFutura(soloFecha(c.cit_fecha_cita)); })
    .sort(function (a, b) { return aFecha(soloFecha(a.cit_fecha_cita)) - aFecha(soloFecha(b.cit_fecha_cita)) || (a.cit_hora_inicio || "").localeCompare(b.cit_hora_inicio || ""); });

  const pasadas = citas.filter(function (c) { return !esFutura(soloFecha(c.cit_fecha_cita)); })
    .sort(function (a, b) { return aFecha(soloFecha(b.cit_fecha_cita)) - aFecha(soloFecha(a.cit_fecha_cita)) || (b.cit_hora_inicio || "").localeCompare(a.cit_hora_inicio || ""); });

  proximas.innerHTML = futuras.length
    ? agrupar(futuras)
    : vacio("No tienes citas próximas. Usa el botón + para agendar una.");

  if (anteriores) {
    anteriores.innerHTML = pasadas.length
      ? agrupar(pasadas)
      : vacio("Todavía no hay visitas anteriores.");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  iniciarLayout();
  iniciarCitas();

  // Tiempo real: si una cita propia se crea/edita/cambia de estado en
  // cualquier otro lugar, la agenda se refresca sola, sin recargar.
  import("../services/websocket_service.js").then(function (ws) {
    ws.suscribir("CITA_ACTUALIZADA", iniciarCitas);
  });
});
