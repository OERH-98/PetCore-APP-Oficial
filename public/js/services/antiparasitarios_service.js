const API_URL = "https://site--backend-petcore--qfjc54hbttpk.code.run/api/antiparasitarios";

// GET /api/antiparasitarios/por_mascota/{id} — usado por Notificaciones
// para el recordatorio de próxima aplicación.
export async function obtenerAntiparasitariosPorMascota(masId) {
    try {
        const respuesta = await fetch(`${API_URL}/por_mascota/${masId}`);
        if (!respuesta.ok) throw new Error("Error al obtener los antiparasitarios de la mascota");
        return (await respuesta.json()) || [];
    } catch (error) {
        console.error("Error en obtenerAntiparasitariosPorMascota:", error);
        return [];
    }
}
