const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/notificaciones_destinatarios";

// GET /api/notificaciones_destinatarios/propietario/{proId}/leida/0 — solo las
// notificaciones no leídas del propietario logueado.
export async function obtenerNoLeidasPorPropietario(proId) {
    try {
        const respuesta = await fetch(`${API_URL}/propietario/${proId}/leida/0`);

        if (!respuesta.ok) {
            console.error("Error al obtener las notificaciones no leídas");
            throw new Error("Error al obtener las notificaciones no leídas");
        }

        return await respuesta.json();
    }
    catch (error) {
        console.error("Error en obtenerNoLeidasPorPropietario:", error);
        throw error;
    }
}

// GET /api/notificaciones_destinatarios/propietario/{proId}/leida/1 — el
// historial de notificaciones ya leídas, para la pestaña "Leídas".
export async function obtenerLeidasPorPropietario(proId) {
    try {
        const respuesta = await fetch(`${API_URL}/propietario/${proId}/leida/1`);

        if (!respuesta.ok) {
            console.error("Error al obtener las notificaciones leídas");
            throw new Error("Error al obtener las notificaciones leídas");
        }

        return await respuesta.json();
    }
    catch (error) {
        console.error("Error en obtenerLeidasPorPropietario:", error);
        throw error;
    }
}

// PUT /api/notificaciones_destinatarios/{id} — marca una notificación como
// leída. El endpoint reemplaza el registro completo, así que se reenvía el
// destinatario tal cual con nod_leida y nod_fecha_lectura actualizados.
export async function marcarComoLeida(destinatario) {
    try {
        const actualizado = {
            ...destinatario,
            nod_leida: 1,
            nod_fecha_lectura: new Date().toISOString()
        };

        const respuesta = await fetch(`${API_URL}/${destinatario.nod_id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(actualizado)
        });

        if (!respuesta.ok) {
            console.error("Error al marcar la notificación como leída");
            throw new Error("Error al marcar la notificación como leída");
        }

        return await respuesta.json();
    }
    catch (error) {
        console.error("Error en marcarComoLeida:", error);
        throw error;
    }
}
