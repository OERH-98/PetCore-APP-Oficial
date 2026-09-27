const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/servicios";

// GET /api/servicios/activos — usado por nueva_cita.html para elegir servicio
export const obtenerServiciosActivos = async () => {
    try {
        const respuesta = await fetch(`${API_URL}/activos`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) {
            throw new Error(`Error HTTP al obtener los servicios activos: ${respuesta.status}`);
        }

        const json = await respuesta.json();
        // El endpoint envuelve la lista en { success, message, data } como el resto
        // de la API — antes se devolvía el sobre completo sin desempaquetar.
        return json;

    } catch (error) {
        console.error("Error en obtenerServiciosActivos:", error);
        return []; // Retornamos un arreglo vacío en caso de error para no romper mapeos o tablas
    }
};
