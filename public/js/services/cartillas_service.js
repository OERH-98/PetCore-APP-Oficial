const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/cartillas";

// GET /api/cartillas/por_mascota/{id} — vacunas de una mascota (usado por
// Notificaciones para el recordatorio de refuerzo próximo a vencer).
export async function obtenerCartillasPorMascota(masId) {
    try {
        const respuesta = await fetch(`${API_URL}/por_mascota/${masId}`);
        if (!respuesta.ok) throw new Error("Error al obtener las vacunas de la mascota");
        return (await respuesta.json()) || [];
    } catch (error) {
        console.error("Error en obtenerCartillasPorMascota:", error);
        return [];
    }
}

export async function obtenerCartillas() {
    try {
        const respuesta = await fetch(API_URL);

        if (!respuesta.ok) {
            console.error("Error al obtener registros");
            throw new Error("Error al obtener los registros");
        }

        const registros = await respuesta.json();
        return registros;
    }
    catch (error) {
        console.error("Error al obtener registros:", error);
        throw error;
    }
}
