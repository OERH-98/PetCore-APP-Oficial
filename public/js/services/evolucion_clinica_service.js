const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/evoluciones_clinicas";

// GET /api/evolucion_clinica/por_hospitalizacion/{id} — usado por
// Notificaciones para avisar de una evolución clínica nueva durante un
// internamiento.
export async function obtenerEvolucionPorHospitalizacion(hospId) {
    try {
        const respuesta = await fetch(`${API_URL}/por_hospitalizacion/${hospId}`);
        if (!respuesta.ok) throw new Error("Error al obtener la evolución clínica de la hospitalización");
        return (await respuesta.json()) || [];
    } catch (error) {
        console.error("Error en obtenerEvolucionPorHospitalizacion:", error);
        return [];
    }
}
