const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/mascotas";

// PUT /api/mascotas/{id}/foto (multipart "foto") — el propietario cambia SOLO la foto de su mascota.
// Devuelve la mascota actualizada (con mas_foto_url nueva).
export async function actualizarFotoMascota(masId, archivo) {
    try {
        const datos = new FormData();
        datos.append("foto", archivo);
        const respuesta = await fetch(`${API_URL}/${masId}/foto`, { method: "PUT", body: datos });
        if (!respuesta.ok) {
            const json = await respuesta.json().catch(() => null);
            const error = new Error(json?.message || "No se pudo actualizar la foto");
            error.status = respuesta.status;
            throw error;
        }
        return await respuesta.json();
    }
    catch (error) {
        console.error("Error en actualizarFotoMascota:", error);
        throw error;
    }
}

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
