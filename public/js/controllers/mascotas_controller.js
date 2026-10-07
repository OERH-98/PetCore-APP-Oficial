/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/mascotas_controller.js
   Controller de pages/mascotas.html.
   Servicio usado: mascotas_service.js
   ========================================================================== */
import { obtenerMascotasPorPropietario } from "../services/mascotas_service.js";
import { obtenerExpedientesPorMascota } from "../services/expedientes_service.js";
import { iniciarLayout, requerirSesion, edadTexto, badge, retrato, vacio, soloFecha, fechaLarga, error as vacioError, quitarEsqueleto, escaparHtml } from "./utils.js";

/* Última visita real (GET /api/expedientes/mascota/{id}), no un texto fijo:
   MascotasDTO no trae esa fecha embebida, así que hace falta una llamada
   aparte por mascota -- igual que ya hace mascota_detalle_controller.js
   para el historial clínico completo de una mascota puntual. Tolerante a
   fallos por mascota individual: si esa llamada falla, esa tarjeta
   simplemente muestra "Sin registros" en vez de tumbar toda la lista. */
async function obtenerUltimaVisita(masId) {
  try {
    const expedientes = await obtenerExpedientesPorMascota(masId);
    if (!expedientes || !expedientes.length) return null;
    const masReciente = expedientes.reduce(function (a, b) {
      return new Date(b.exp_fecha_consulta) > new Date(a.exp_fecha_consulta) ? b : a;
    });
    return masReciente.exp_fecha_consulta || null;
  } catch (e) {
    return null;
  }
}

// Tiempo mínimo que se deja el esqueleto en pantalla: la API local suele
// responder en unos pocos milisegundos, tan rápido que el shimmer nunca
// alcanza a notarse -- sin este mínimo, "no se ve el esqueleto" no es un
// bug de CSS, es que en la práctica nunca llega a pintarse un frame con él.
const ESPERA_MINIMA_MS = 400;

function esperar(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function iniciarMascotas() {
  const lista = document.getElementById("pcListaMascotas");
  if (!lista) return;

  const sesion = await requerirSesion();
  if (!sesion) return;

  const contador = document.getElementById("pcContadorMascotas");
  const inicio = Date.now();

  let mascotas = [];
  try {
    mascotas = (await obtenerMascotasPorPropietario(sesion.pro_id)) || [];
    const transcurrido = Date.now() - inicio;
    if (transcurrido < ESPERA_MINIMA_MS) await esperar(ESPERA_MINIMA_MS - transcurrido);
  } catch (e) {
    lista.innerHTML = '<div class="col-12">' + vacioError("No se pudo conectar con el servidor. Intenta más tarde.") + "</div>";
    if (contador) { contador.textContent = ""; quitarEsqueleto(contador); }
    return;
  }

  if (contador) {
    contador.textContent = mascotas.length
      ? mascotas.length + (mascotas.length === 1 ? " mascota registrada" : " mascotas registradas")
      : "";
    quitarEsqueleto(contador);
  }

  if (!mascotas.length) {
    lista.innerHTML = '<div class="col-12">' + vacio("Aún no hay mascotas asociadas a tu cuenta.") + "</div>";
    return;
  }

  // Una llamada a expedientes por mascota, en paralelo, ANTES de pintar --
  // así cada tarjeta nace ya con su última visita real y no hay que
  // reemplazar (ni reanimar) las tarjetas una segunda vez.
  const ultimasVisitas = await Promise.all(mascotas.map(function (m) { return obtenerUltimaVisita(m.mas_id); }));

  lista.innerHTML = mascotas.map(function (m, i) {
    const texto = ultimasVisitas[i] ? fechaLarga(soloFecha(ultimasVisitas[i])) : "Sin registros";
    return tarjetaMascota(m, i, texto);
  }).join("");
}

function tarjetaMascota(m, i, ultimaVisita) {
  return (
    '<div class="col-12 col-md-6">' +
      '<article class="pc-card pc-card-pulsable p-3 h-100 d-flex flex-column animate__animated animate__fadeInUp animate__faster" style="animation-delay:' + (i * 40) + 'ms">' +
        '<div class="d-flex gap-3 align-items-center">' +
          retrato(m) +
          '<div class="min-w-0">' +
            '<h2 class="h5 mb-1">' + escaparHtml(m.mas_nombre) + "</h2>" +
            '<p class="pc-meta mb-2">' + escaparHtml(m.nombreRaza || "Raza no indicada") + " · " + edadTexto(soloFecha(m.mas_fecha_nac)) + "</p>" +
            badge(m.mas_estado) +
          "</div>" +
        "</div>" +
        '<dl class="row g-0 mt-3 mb-3 pc-meta">' +
          '<dt class="col-6 fw-normal">Peso actual</dt>' +
          '<dd class="col-6 text-end mb-1 pc-dato fw-semibold">' + (m.mas_peso_kg != null ? m.mas_peso_kg + " kg" : "—") + "</dd>" +
          '<dt class="col-6 fw-normal">Última visita</dt>' +
          '<dd class="col-6 text-end mb-0 fw-semibold">' + ultimaVisita + "</dd>" +
        "</dl>" +
        '<a class="btn btn-primary w-100 mt-auto" href="mascota_detalle.html?id=' + m.mas_id + '">' +
          'Ver detalles<span class="visually-hidden"> de ' + escaparHtml(m.mas_nombre) + "</span></a>" +
      "</article>" +
    "</div>"
  );
}

document.addEventListener("DOMContentLoaded", function () {
  iniciarLayout();
  iniciarMascotas();
});
