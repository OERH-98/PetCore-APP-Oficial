const API_URL = "https://site--backend-petcore--qfjc54hbttpk.code.run/api/expedientes";

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
