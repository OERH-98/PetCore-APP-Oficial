const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/diagnosticos_expediente";

// GET /api/diagnosticos_expediente/expediente/{expId} — usado por
// Notificaciones para avisar de un diagnóstico nuevo en el expediente.
export async function obtenerDiagnosticosPorExpediente(expId) {
    try {
        const respuesta = await fetch(`${API_URL}/expediente/${expId}`);
        if (!respuesta.ok) throw new Error("Error al obtener los diagnósticos del expediente");
        return (await respuesta.json()) || [];
    } catch (error) {
        console.error("Error en obtenerDiagnosticosPorExpediente:", error);
        return [];
    }
}
