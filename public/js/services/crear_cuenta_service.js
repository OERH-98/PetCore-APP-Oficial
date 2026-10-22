/* ==========================================================================
   PetCore — Portal de Propietarios
   js/services/crear_cuenta_service.js
   Crear la cuenta del portal a partir del DUI -- solo para propietarios que ya
   están registrados en la clínica y todavía no tienen acceso. El código llega
   al correo que la clínica tiene guardado (nunca a uno que escriba quien lo
   pide). Contra /api/auth/registro/propietario.
   ========================================================================== */
const API_URL_BASE = "https://site--backend-petcore--qfjc54hbttpk.code.run/api/auth/registro/propietario";

async function leerError(respuesta, mensajePorDefecto) {
    const cuerpo = await respuesta.json().catch(() => null);
    const error = new Error(cuerpo?.message || mensajePorDefecto);
    error.status = respuesta.status;
    return error;
}

export async function solicitarCodigoCuenta(dui) {
    try {
        const respuesta = await fetch(`${API_URL_BASE}/solicitar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dui })
        });

        if (!respuesta.ok) throw await leerError(respuesta, "No se pudo solicitar el código.");
        return await respuesta.json();
    } catch (error) {
        console.error("Error al solicitar el código de creación de cuenta:", error);
        throw error;
    }
}

export async function verificarCodigoCuenta(dui, codigo) {
    try {
        const respuesta = await fetch(`${API_URL_BASE}/verificar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dui, codigo })
        });

        if (!respuesta.ok) throw await leerError(respuesta, "El código no es válido.");
    } catch (error) {
        console.error("Error al verificar el código de creación de cuenta:", error);
        throw error;
    }
}

export async function crearCuenta(dui, codigo, nombreUsuario, contrasenia) {
    try {
        const respuesta = await fetch(`${API_URL_BASE}/crear`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dui, codigo, nombreUsuario, contrasenia })
        });

        if (!respuesta.ok) throw await leerError(respuesta, "No se pudo crear la cuenta.");
    } catch (error) {
        console.error("Error al crear la cuenta:", error);
        throw error;
    }
}
