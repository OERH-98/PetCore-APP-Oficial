const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/expedientes";

// GET /api/expedientes/mascota/{masId} — historial clínico de una mascota
export async function obtenerExpedientesPorMascota(masId) {
    try {
        const respuesta = await fetch(`${API_URL}/mascota/${masId}`);
        if (!respuesta.ok) {
            throw new Error("Error al obtener el historial clínico");
        }
        const json = await respuesta.json();
        return json;
    }
    catch (error) {
        console.error("Error en obtenerExpedientesPorMascota:", error);
        throw error;
    }
}
