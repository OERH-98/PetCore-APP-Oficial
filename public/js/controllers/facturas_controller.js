/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/facturas_controller.js
   Controller de pages/facturas.html: solo el listado y el resumen de gasto.
   El detalle de cada factura (con su tabla de ítems y el botón de
   descargar PDF) vive en su propia página -- factura_detalle.html,
   navegada con ?id=<ven_id> -- en vez de un popup de SweetAlert2: en un
   modal de 400px la tabla de ítems no entraba y los datos quedaban
   amontonados, se veía mal.
   ========================================================================== */
import { obtenerVentasPorPropietario } from "../services/ventas_service.js";
import {
  iniciarLayout, requerirSesion, dinero, fechaLarga, badge,
  vacio, soloFecha, error as vacioError, quitarEsqueleto, escaparHtml
} from "./utils.js";

async function iniciarFacturas() {
  const lista = document.getElementById("pcListaFacturas");
  if (!lista) return;

  const sesion = requerirSesion();
  if (!sesion) return;

  const resumen = document.getElementById("pcTotalGastado");
  const detalle = document.getElementById("pcDetalleGasto");

  let facturasCargadas = [];
  try {
    facturasCargadas = (await obtenerVentasPorPropietario(sesion.pro_id)) || [];
  } catch (e) {
    lista.innerHTML = vacioError("No se pudo conectar con el servidor. Intenta más tarde.");
    if (resumen) { resumen.textContent = dinero(0); quitarEsqueleto(resumen); }
    if (detalle) { detalle.textContent = ""; quitarEsqueleto(detalle); }
    return;
  }

  const pagadas = facturasCargadas.filter(function (f) { return f.ven_estado === "Pagada"; });
  const total = pagadas.reduce(function (suma, f) { return suma + Number(f.ven_total || 0); }, 0);

  if (resumen) { resumen.textContent = dinero(total); quitarEsqueleto(resumen); }

  if (detalle) {
    detalle.textContent = pagadas.length + (pagadas.length === 1 ? " factura pagada" : " facturas pagadas") +
      " · " + facturasCargadas.length + " en total";
    quitarEsqueleto(detalle);
  }

  lista.innerHTML = facturasCargadas.length
    ? facturasCargadas.map(function (f, i) {
        const numero = f.ven_numero_comprobante || "Sin número";
        return (
          '<a href="factura_detalle.html?id=' + f.ven_id + '" class="pc-card pc-card-pulsable p-3 mb-2 w-100 text-start border-0 d-block text-decoration-none animate__animated animate__fadeInUp animate__faster" ' +
            'style="animation-delay:' + (i * 40) + 'ms">' +
            '<div class="d-flex justify-content-between align-items-start gap-2">' +
              '<div class="min-w-0">' +
                '<p class="pc-registro-titulo mb-1 pc-dato">' + escaparHtml(numero) + "</p>" +
                '<p class="pc-meta mb-2">' + fechaLarga(soloFecha(f.ven_fecha)) + " · " + escaparHtml(f.ven_metodo_pago || "") + "</p>" +
                badge(f.ven_estado) +
              "</div>" +
              '<div class="d-flex flex-column align-items-end flex-shrink-0">' +
                '<p class="pc-total fs-4 mb-0' + (f.ven_estado === "Anulada" ? " text-decoration-line-through opacity-50" : "") + '">' +
                  dinero(f.ven_total) + "</p>" +
                '<i class="fa-solid fa-chevron-right text-secondary mt-1"></i>' +
              "</div>" +
            "</div>" +
          "</a>"
        );
      }).join("")
    : vacio("Todavía no tienes facturas registradas.");
}

document.addEventListener("DOMContentLoaded", function () {
  iniciarLayout();
  iniciarFacturas();
});
