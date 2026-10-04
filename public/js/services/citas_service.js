const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/citas";

export async function obtenerCitas() {
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

// GET /api/citas/rango?desde=yyyy-MM-dd&hasta=yyyy-MM-dd -- solo las citas de ese rango de fechas (el formulario
// de agendar solo necesita las próximas para saber qué horarios están ocupados, no toda la tabla de la clínica).
export async function obtenerCitasPorRango(desde, hasta) {
    try {
        const respuesta = await fetch(`${API_URL}/rango?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`);

        if (!respuesta.ok) {
            console.error("Error al obtener las citas del rango");
            throw new Error("Error al obtener las citas del rango");
        }

        return await respuesta.json();
    }
    catch (error) {
        console.error("Error en obtenerCitasPorRango:", error);
        throw error;
    }
}

// GET /api/citas/mascota/{masId} — solo las citas de una mascota (usado en el
// detalle de mascota, en vez de traer todas las citas de la clínica y filtrar
// "las de esta mascota" en el cliente).
export async function obtenerCitasPorMascota(masId) {
    try {
        const respuesta = await fetch(`${API_URL}/mascota/${masId}`);

        if (!respuesta.ok) {
            console.error("Error al obtener las citas de la mascota");
            throw new Error("Error al obtener las citas de la mascota");
        }

        return await respuesta.json();
    }
    catch (error) {
        console.error("Error en obtenerCitasPorMascota:", error);
        throw error;
    }
}

// GET /api/citas/propietario/{proId} — solo las citas del propietario logueado,
// en vez de traer todas las citas de la clínica y filtrar "las mías" en el cliente.
export async function obtenerCitasPorPropietario(proId) {
    try {
        const respuesta = await fetch(`${API_URL}/propietario/${proId}`);

        if (!respuesta.ok) {
            console.error("Error al obtener las citas del propietario");
            throw new Error("Error al obtener las citas del propietario");
        }

        return await respuesta.json();
    }
    catch (error) {
        console.error("Error en obtenerCitasPorPropietario:", error);
        throw error;
    }
}

export async function crearCita(cita) {
    try {
        const respuesta = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(cita)
        });

        if (!respuesta.ok) {
            throw new Error("Error al crear el registro");
        }

        const nuevoRegistro = await respuesta.json();
        return nuevoRegistro;
    }
    catch (error) {
        console.error("Error al crear registro:", error);
        throw error;
    }
}
