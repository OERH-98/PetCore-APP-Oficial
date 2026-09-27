const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/detalles_ventas";

// GET /api/detalles_ventas/por_venta/{id} — líneas (productos/servicios) de
// una factura puntual, para el detalle completo en facturas.html.
export async function obtenerDetallesPorVenta(ventaId) {
    try {
        const respuesta = await fetch(`${API_URL}/por_venta/${ventaId}`);
        if (!respuesta.ok) throw new Error("Error al obtener el detalle de la factura");
        const json = await respuesta.json();
        return json ?? [];
    }
    catch (error) {
        console.error("Error en obtenerDetallesPorVenta:", error);
        throw error;
    }
}
