const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/hospitalizaciones";

// GET /api/hospitalizaciones/por_mascota/{id} — usado por Notificaciones
// para saber si una mascota propia está (o estuvo) internada y así poder
// avisar de evoluciones clínicas nuevas.
export async function obtenerHospitalizacionesPorMascota(masId) {
    try {
        const respuesta = await fetch(`${API_URL}/por_mascota/${masId}`);
        if (!respuesta.ok) throw new Error("Error al obtener las hospitalizaciones de la mascota");
        return (await respuesta.json()) || [];
    } catch (error) {
        console.error("Error en obtenerHospitalizacionesPorMascota:", error);
        return [];
    }
}
