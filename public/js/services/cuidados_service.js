const API_URL = "https://site--backend-petcore--qfjc54hbttpk.code.run/api/cuidados";

export async function obtenerCuidadosDeMascota(masId) {
    try {
        const respuesta = await fetch(`${API_URL}/mascota/${masId}`);
        
        if (!respuesta.ok) {
            console.error("Error al obtener los cuidados de la mascota");
            throw new Error("Error al obtener los cuidados de la mascota");
        }
        
        const registros = await respuesta.json();
        return registros;
    }
    catch (error) {
        console.error("Error al obtener cuidados:", error);
        throw error;
    }
}
