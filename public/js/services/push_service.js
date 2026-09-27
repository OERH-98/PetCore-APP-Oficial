/* ==========================================================================
   PetCore — Portal de Propietarios
   js/services/push_service.js
   Llamadas HTTP a /api/push -- ver PushSuscripcionController en API_PetCore.
   push_utils.js (Web Push + Service Worker) usa este service en vez de
   hacer fetch() directo, igual que el resto de la app.
   ========================================================================== */
const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/push";

// GET /api/push/vapid-public-key -- pública por diseño del propio estándar
// Web Push (es la mitad pública del par VAPID), no requiere sesión.
export async function obtenerLlavePublicaPush() {
    try {
        const respuesta = await fetch(`${API_URL}/vapid-public-key`);

        if (!respuesta.ok) {
            console.error("Error al obtener la llave pública de push");
            throw new Error("No se pudo obtener la llave pública de notificaciones push.");
        }

        const datos = await respuesta.json();
        return datos.publicKey;
    } catch (error) {
        console.error("Error al obtener la llave pública de push:", error);
        throw error;
    }
}

// POST /api/push/suscripciones -- el pro_id lo resuelve el backend de la
// cookie de sesión (authTokenPropietario), nunca se manda desde aquí.
export async function registrarSuscripcionPush({ endpoint, p256dh, auth, userAgent }) {
    try {
        const respuesta = await fetch(`${API_URL}/suscripciones`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint, p256dh, auth, userAgent })
        });

        if (!respuesta.ok) {
            console.error("Error al registrar la suscripción push");
            throw new Error("No se pudo registrar la suscripción de notificaciones push.");
        }

        return true;
    } catch (error) {
        console.error("Error al registrar la suscripción push:", error);
        throw error;
    }
}

// GET /api/push/suscripciones/activa?endpoint=... -- una suscripción es del
// NAVEGADOR, no del usuario: si dos propietarios comparten un dispositivo,
// esto confirma que el endpoint que ya tiene el navegador sigue siendo el
// de quien inició sesión ahora mismo, no el de quien activó push antes.
export async function suscripcionActivaParaMi(endpoint) {
    try {
        const parametros = new URLSearchParams({ endpoint });
        const respuesta = await fetch(`${API_URL}/suscripciones/activa?${parametros.toString()}`);

        if (!respuesta.ok) {
            console.error("Error al verificar la suscripción push");
            throw new Error("No se pudo verificar el estado de las notificaciones push.");
        }

        const datos = await respuesta.json();
        return !!datos.activa;
    } catch (error) {
        console.error("Error al verificar la suscripción push:", error);
        throw error;
    }
}

// DELETE /api/push/suscripciones?endpoint=... -- todavía sin botón propio
// en Preferencias, pero ya disponible para cuando se agregue "Desactivar".
// Devuelve "ultimaSuscripcion": true cuando, tras borrar la fila de quien
// está desactivando, no queda ningún otro propietario/empleado suscrito en
// ese mismo dispositivo -- solo en ese caso es seguro cancelar también la
// suscripción real del PushManager (compartida por todos los que usan ese
// dispositivo), igual que en su equivalente de Frontend-PETCORE.
export async function eliminarSuscripcionPush(endpoint) {
    try {
        const parametros = new URLSearchParams({ endpoint });
        const respuesta = await fetch(`${API_URL}/suscripciones?${parametros.toString()}`, { method: "DELETE" });

        if (!respuesta.ok) {
            console.error("Error al eliminar la suscripción push");
            throw new Error("No se pudo desactivar la suscripción de notificaciones push.");
        }

        const cuerpo = await respuesta.json().catch(() => null);
        return !!cuerpo?.ultimaSuscripcion;
    } catch (error) {
        console.error("Error al eliminar la suscripción push:", error);
        throw error;
    }
}
