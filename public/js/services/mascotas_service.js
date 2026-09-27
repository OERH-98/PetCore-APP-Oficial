const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/mascotas";

// GET /api/mascotas/por_propietario/{id} — mascotas de un propietario específico
export async function obtenerMascotasPorPropietario(proId) {
    try {
        const respuesta = await fetch(`${API_URL}/por_propietario/${proId}`);
        if (!respuesta.ok) throw new Error("Error al obtener las mascotas del propietario");
        const json = await respuesta.json();
        return json;
    }
    catch (error) {
        console.error("Error en obtenerMascotasPorPropietario:", error);
        throw error;
    }
}
