/* ==========================================================================
   PetCore — Portal de Propietarios
   js/services/recuperar_contrasena_service.js
   Recuperación de contraseña por código enviado al correo -- mismo patrón
   que el frontend de escritorio (js/services/recuperar_contrasena_service.js
   ahí), pero contra /recuperar/propietario en vez de /recuperar/empleado.
   Auth_API guarda el código SOLO en memoria, no en la base de datos.
   ========================================================================== */
const API_URL_BASE = "https://petcore-8afada45fabc.herokuapp.com/api/auth/recuperar/propietario";

async function leerError(respuesta, mensajePorDefecto) {
    const cuerpo = await respuesta.json().catch(() => null);
    const error = new Error(cuerpo?.message || mensajePorDefecto);
    error.status = respuesta.status;
    return error;
}

export async function solicitarCodigoRecuperacion(correo) {
    try {
        const respuesta = await fetch(`${API_URL_BASE}/solicitar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ correo })
        });

        if (!respuesta.ok) throw await leerError(respuesta, "No se pudo solicitar el código de recuperación.");
        return await respuesta.json();
    } catch (error) {
        console.error("Error al solicitar el código de recuperación:", error);
        throw error;
    }
}

export async function verificarCodigoRecuperacion(correo, codigo) {
    try {
        const respuesta = await fetch(`${API_URL_BASE}/verificar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ correo, codigo })
        });

        if (!respuesta.ok) throw await leerError(respuesta, "El código no es válido.");
    } catch (error) {
        console.error("Error al verificar el código de recuperación:", error);
        throw error;
    }
}

export async function restablecerContraseniaConCodigo(correo, codigo, contraseniaNueva) {
    try {
        const respuesta = await fetch(`${API_URL_BASE}/restablecer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ correo, codigo, contraseniaNueva })
        });

        if (!respuesta.ok) throw await leerError(respuesta, "No se pudo restablecer la contraseña.");
    } catch (error) {
        console.error("Error al restablecer la contraseña:", error);
        throw error;
    }
}
