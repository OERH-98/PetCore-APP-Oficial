/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/dashboard_controller.js
   Controller de pages/dashboard.html.
   Servicios usados: mascotas_service.js, citas_service.js
   ========================================================================== */
import { obtenerMascotasPorPropietario } from "../services/mascotas_service.js";
import { obtenerCitasPorPropietario } from "../services/citas_service.js";
import { obtenerPropietarioPorId } from "../services/propietarios_service.js";
import {
  iniciarLayout, requerirSesion, esFutura, aFecha, badge, bloqueFecha,
  retrato, soloFecha, nombreEmpleado, error as vacioError, quitarEsqueleto,
  escaparHtml
} from "./utils.js";
import { activarPushNativo, iniciarAperturaDeNotificacionesPush } from "../utils/push_fcm_utils.js";

function mascotaPorId(mascotas, id) {
  return mascotas.find(function (m) { return Number(m.mas_id) === Number(id); }) || mascotas[0];
}

async function iniciarDashboard() {
  const carrusel = document.getElementById("pcCarrusel");
  if (!carrusel) return;

  const sesion = requerirSesion();
  if (!sesion) return; // requerirSesion ya redirigió a login.html

  const saludo = document.getElementById("pcSaludo");
  const retratoSaludo = document.getElementById("pcSaludoRetrato");
  const fotoSaludo = document.getElementById("pcSaludoFoto");
  const inicialSaludo = document.getElementById("pcSaludoInicial");
  const resumen = document.getElementById("pcResumen");
  const caja = document.getElementById("pcProximaCita");

  let mascotas = [];
  let citas = [];
  let propietario = null;

  try {
    [mascotas, citas, propietario] = await Promise.all([
      obtenerMascotasPorPropietario(sesion.pro_id),
      obtenerCitasPorPropietario(sesion.pro_id),
      obtenerPropietarioPorId(sesion.pro_id)
    ]);
    mascotas = mascotas || [];
    citas = citas || [];
  } catch (e) {
    if (saludo) { saludo.textContent = "¡Hola de nuevo!"; quitarEsqueleto(saludo); }
    if (retratoSaludo) quitarEsqueleto(retratoSaludo);
    if (resumen) { resumen.textContent = "No se pudo cargar tu resumen."; quitarEsqueleto(resumen); }
    if (caja) caja.innerHTML = vacioError("No se pudo conectar con el servidor. Intenta más tarde.");
    carrusel.innerHTML = "";
    return;
  }

  if (saludo) {
    const nombre = (propietario && propietario.pro_nombre) || sesion.nombre || sesion.pro_nombre || sesion.correo || "";
    saludo.textContent = nombre ? "¡Hola, " + nombre + "!" : "¡Hola de nuevo!";
    quitarEsqueleto(saludo);
  }

  if (inicialSaludo && propietario) {
    inicialSaludo.textContent = (propietario.pro_nombre || "").charAt(0) + (propietario.pro_apellido || "").charAt(0);
  }
  if (fotoSaludo && inicialSaludo && propietario && propietario.pro_foto_url) {
    fotoSaludo.onerror = function () {
      fotoSaludo.classList.add("d-none");
      inicialSaludo.classList.remove("d-none");
    };
    fotoSaludo.alt = "Foto de perfil de " + (propietario.pro_nombre || "");
    fotoSaludo.src = propietario.pro_foto_url;
    fotoSaludo.classList.remove("d-none");
    inicialSaludo.classList.add("d-none");
  }
  if (retratoSaludo) quitarEsqueleto(retratoSaludo);

  if (resumen) {
    const pendientes = citas.filter(function (c) {
      return esFutura(soloFecha(c.cit_fecha_cita)) && c.cit_estado !== "Cancelada";
    }).length;
    resumen.textContent = pendientes === 0
      ? "No tienes citas pendientes."
      : "Tienes " + pendientes + (pendientes === 1 ? " cita programada." : " citas programadas.");
    quitarEsqueleto(resumen);
  }

  // --- Próxima cita ---
  const proxima = citas
    .filter(function (c) { return esFutura(soloFecha(c.cit_fecha_cita)) && (c.cit_estado === "Agendada" || c.cit_estado === "Confirmada"); })
    .sort(function (a, b) { return aFecha(soloFecha(a.cit_fecha_cita)) - aFecha(soloFecha(b.cit_fecha_cita)); })[0];

  if (caja) {
    if (proxima && mascotas.length) {
      const m = mascotaPorId(mascotas, proxima.cit_mas_id);
      caja.innerHTML =
        '<div class="d-flex justify-content-between align-items-start gap-2 mb-3">' +
          '<span class="pc-eyebrow">Próxima cita</span>' + badge(proxima.cit_estado) +
        "</div>" +
        '<div class="d-flex gap-3 align-items-center">' +
          bloqueFecha(soloFecha(proxima.cit_fecha_cita)) +
          '<div class="flex-grow-1 min-w-0">' +
            '<p class="pc-registro-titulo mb-1">' + escaparHtml(proxima.cit_motivo || "") + "</p>" +
            '<p class="pc-meta mb-0"><i class="fa-solid fa-paw me-1"></i>' + (m ? escaparHtml(m.mas_nombre) : "") +
              ' · <i class="fa-solid fa-clock ms-1 me-1"></i><span class="pc-dato">' + escaparHtml(proxima.cit_hora_inicio) + "</span></p>" +
            '<p class="pc-meta mb-0"><i class="fa-solid fa-user-doctor me-1"></i>' + escaparHtml(nombreEmpleado(proxima)) + "</p>" +
          "</div>" +
        "</div>" +
        '<a class="btn btn-primary w-100 mt-3" href="mascota_detalle.html?id=' + (m ? m.mas_id : "") + '#panelCitas">Ver detalle</a>';
    } else {
      caja.innerHTML =
        '<span class="pc-eyebrow d-block mb-2">Próxima cita</span>' +
        '<p class="pc-meta mb-3">No tienes citas programadas.</p>' +
        '<a class="btn btn-primary w-100" href="nueva_cita.html">Agendar una cita</a>';
    }
  }

  // --- Carrusel de mascotas ---
  carrusel.innerHTML = mascotas.length
    ? mascotas.map(function (m, i) {
        return (
          '<a class="pc-card pc-card-pulsable pc-carrusel-item animate__animated animate__fadeInUp animate__faster" style="animation-delay:' + (i * 40) + 'ms" href="mascota_detalle.html?id=' + m.mas_id + '">' +
            retrato(m) +
            '<p class="fw-bold mb-1 mt-2">' + escaparHtml(m.mas_nombre) + "</p>" +
            badge(m.mas_estado) +
          "</a>"
        );
      }).join("")
    : '<p class="pc-meta">Aún no tienes mascotas registradas.</p>';
}

document.addEventListener("DOMContentLoaded", function () {
  iniciarLayout();
  iniciarDashboard();

  // dashboard.html es la primera pantalla AUTENTICADA a la que se llega,
  // tanto justo después de iniciar sesión como al reabrir la app con una
  // sesión ya guardada -- por eso "se autoactive por cada login" queda
  // cubierto acá, sin pedirle nada al usuario (registrar el token necesita
  // sesión, que index.html/login.html todavía no tienen). No-op fuera de la
  // app nativa.
  activarPushNativo();
  iniciarAperturaDeNotificacionesPush();

  // Tiempo real: si una cita propia se crea/edita/cambia de estado en
  // cualquier otro lugar (recepción, el propio veterinario), el resumen y
  // la "Próxima cita" se refrescan solos, sin recargar la página.
  import("../services/websocket_service.js").then(function (ws) {
    ws.suscribir("CITA_ACTUALIZADA", iniciarDashboard);
  });
});
