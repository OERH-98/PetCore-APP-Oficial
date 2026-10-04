/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/factura_detalle_controller.js
   Controller de pages/factura_detalle.html -- reemplaza al popup de
   SweetAlert2 que antes abría facturas_controller.js (se veía fatal en un
   modal de 400px: la tabla de ítems no entraba y los datos quedaban
   amontonados). Misma idea que mascota_detalle.html: página propia,
   navegada con ?id=<ven_id> desde la lista de facturas.

   Servicios usados: ventas_service.js (no hay endpoint "por id" -- se trae
   la lista completa del propietario y se busca la que corresponde, mismo
   patrón que mascota_detalle_controller.js con obtenerMascotasPorPropietario)
   y detalles_ventas_service.js (las líneas de productos/servicios).
   ========================================================================== */
import { obtenerVentasPorPropietario } from "../services/ventas_service.js";
import { obtenerDetallesPorVenta } from "../services/detalles_ventas_service.js";
import {
  iniciarLayout, requerirSesion, paramUrl, dinero, fechaLarga, badge, nombreEmpleado,
  soloFecha, error as vacioError, quitarEsqueleto, escaparHtml, alertar
} from "./utils.js";
import { generarPdfDesdeElemento } from "../utils/pdf_utils.js";

function nombreItemDetalle(d) {
  return d.nombreProducto || d.nombreServicio || d.tituloPrescripcion || "Ítem";
}

function filaItem(d) {
  return (
    "<tr>" +
      "<td>" + escaparHtml(nombreItemDetalle(d)) + "</td>" +
      '<td class="text-center">' + escaparHtml(String(d.dve_cantidad ?? "—")) + "</td>" +
      '<td class="text-end">' + dinero(d.dve_precio_unitario) + "</td>" +
      '<td class="text-end">' + dinero(d.dve_subtotal) + "</td>" +
    "</tr>"
  );
}

function filaTotal(etiqueta, valor, destacado) {
  return (
    "<tr>" +
      '<td colspan="3" class="text-end">' + escaparHtml(etiqueta) + "</td>" +
      '<td class="text-end">' + (destacado ? valor : dinero(valor)) + "</td>" +
    "</tr>"
  );
}

async function iniciarDetalle() {
  const contenido = document.getElementById("pcFacturaContenido");
  if (!contenido) return;

  const sesion = await requerirSesion();
  if (!sesion) return;

  const idSolicitado = paramUrl("id");
  const tituloHeader = document.getElementById("pcTituloHeader");

  let facturas = [];
  try {
    facturas = (await obtenerVentasPorPropietario(sesion.pro_id)) || [];
  } catch (e) {
    console.error("No se pudo cargar la factura:", e);
    contenido.innerHTML = vacioError("No se pudo conectar con el servidor. Intenta más tarde.");
    if (tituloHeader) quitarEsqueleto(tituloHeader);
    return;
  }

  const factura = facturas.find(function (f) { return Number(f.ven_id) === Number(idSolicitado); });
  if (!factura) {
    contenido.innerHTML = vacioError("No se encontró esta factura.");
    if (tituloHeader) quitarEsqueleto(tituloHeader);
    return;
  }

  let detalles = [];
  try {
    detalles = await obtenerDetallesPorVenta(factura.ven_id);
  } catch (e) {
    console.error("No se pudo cargar el detalle de la factura:", e);
  }

  const numero = factura.ven_numero_comprobante || "Comprobante";
  document.title = numero + " | PetCore";
  if (tituloHeader) { tituloHeader.textContent = numero; quitarEsqueleto(tituloHeader); }

  const elNumero = document.getElementById("pcFacturaNumero");
  if (elNumero) { elNumero.textContent = numero; quitarEsqueleto(elNumero); }

  const elFecha = document.getElementById("pcFacturaFecha");
  if (elFecha) { elFecha.textContent = fechaLarga(soloFecha(factura.ven_fecha)); quitarEsqueleto(elFecha); }

  const elEstado = document.getElementById("pcFacturaEstado");
  if (elEstado) elEstado.innerHTML = badge(factura.ven_estado);

  const elDatos = document.getElementById("pcFacturaDatos");
  if (elDatos) {
    elDatos.innerHTML =
      '<div class="d-flex justify-content-between mb-1"><span class="pc-meta">Método de pago</span><span class="fw-semibold">' + escaparHtml(factura.ven_metodo_pago || "—") + "</span></div>" +
      '<div class="d-flex justify-content-between"><span class="pc-meta">Atendido por</span><span class="fw-semibold">' + escaparHtml(nombreEmpleado(factura) || "—") + "</span></div>";
  }

  const elItems = document.getElementById("pcFacturaItems");
  if (elItems) {
    elItems.innerHTML = detalles.length
      ? detalles.map(filaItem).join("")
      : '<tr><td colspan="4" class="text-center text-muted fst-italic py-3">Sin detalle de productos o servicios.</td></tr>';
  }

  const descuento = Number(factura.ven_descuento || 0);
  const elTotales = document.getElementById("pcFacturaTotales");
  if (elTotales) {
    elTotales.innerHTML =
      filaTotal("Subtotal", factura.ven_subtotal) +
      (descuento > 0 ? filaTotal("Descuento", "-" + dinero(descuento), true) : "") +
      filaTotal("IVA (" + (factura.ven_porcentaje_iva ?? 0) + "%)", factura.ven_monto_iva) +
      filaTotal("Total", dinero(factura.ven_total), true);
  }

  const boton = document.getElementById("pcBtnDescargarFactura");
  if (boton) {
    boton.disabled = false;
    boton.addEventListener("click", async function () {
      const original = boton.innerHTML;
      boton.disabled = true;
      boton.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Generando...';
      try {
        const resultado = await generarPdfDesdeElemento("#pcFacturaContenido", {
          titulo: "Factura",
          nombreArchivo: ("factura_" + numero).replace(/\s+/g, "_") + ".pdf"
        });
        // En la app el PDF se guarda en el teléfono (no se abre la hoja de compartir): se avisa dónde quedó.
        if (resultado && resultado.nativo) {
          alertar({ icon: "success", title: "PDF descargado", text: "Se guardó en " + resultado.ubicacion + "." });
        }
      } catch (e) {
        console.error("No se pudo generar el PDF de la factura:", e);
        alertar({ icon: "error", title: "No se pudo generar el PDF", text: "Intenta de nuevo." });
      } finally {
        boton.disabled = false;
        boton.innerHTML = original;
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  iniciarLayout();
  iniciarDetalle();
});
