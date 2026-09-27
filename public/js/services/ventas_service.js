const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/ventas";

// GET /api/ventas/por_propietario/{id} — facturas de un propietario específico
export async function obtenerVentasPorPropietario(proId) {
    try {
        const respuesta = await fetch(`${API_URL}/por_propietario/${proId}`);
        if (!respuesta.ok) throw new Error("Error al obtener las facturas del propietario");
        const json = await respuesta.json();
        return json;
    }
    catch (error) {
        console.error("Error en obtenerVentasPorPropietario:", error);
        throw error;
    }
}
