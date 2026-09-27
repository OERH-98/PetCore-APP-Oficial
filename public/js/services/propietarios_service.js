const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/propietarios";
// Contraseña (verificar/cambiar) vive en API_Auth_PetCore, no en la API
// principal -- ver ContraseniaController ahí.
const API_URL_AUTH_PROPIETARIO = "https://petcore-8afada45fabc.herokuapp.com/api/auth/propietario";

// POST /api/auth/propietario/{id}/verificar-contrasenia (API_Auth_PetCore)
// -- primer paso del cambio de contraseña autoservicio. Lanza error si la
// contraseña no es correcta.
export async function verificarContraseniaPropietario(id, contrasenia) {
    try {
        const respuesta = await fetch(`${API_URL_AUTH_PROPIETARIO}/${id}/verificar-contrasenia`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contrasenia })
        });

        if (!respuesta.ok) {
            const json = await respuesta.json().catch(() => null);
            const error = new Error(json?.message || "La contraseña actual no es correcta");
            error.status = respuesta.status;
            error.details = json?.details || null;
            throw error;
        }
        return true;
    } catch (error) {
        console.error("Error al verificar contraseña:", error);
        throw error;
    }
}

// PATCH /api/auth/propietario/{id}/contrasenia (API_Auth_PetCore) --
// cambio autoservicio (exige la actual).
export async function cambiarContraseniaPropietario(id, contraseniaActual, contraseniaNueva) {
    try {
        const respuesta = await fetch(`${API_URL_AUTH_PROPIETARIO}/${id}/contrasenia`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contraseniaActual, contraseniaNueva })
        });

        if (!respuesta.ok) {
            const json = await respuesta.json().catch(() => null);
            const error = new Error(json?.message || "No se pudo cambiar la contraseña");
            error.status = respuesta.status;
            error.details = json?.details || null;
            throw error;
        }
        return true;
    } catch (error) {
        console.error("Error al cambiar contraseña:", error);
        throw error;
    }
}

// PUT /api/propietarios/{id} -- multipart/form-data, tal como lo espera el
// backend (@RequestPart "config" + "foto" opcional, igual que en el
// frontend de escritorio). Se usa en editar_perfil.html SOLO cuando el
// propietario elige una foto nueva; para editar texto sin foto alcanza con
// actualizarParcialPropietario (PATCH, más liviano y sin pedir el resto de
// los campos). El backend no exige contraseña aquí tampoco: si "config"
// no trae pro_contrasenia, PropietariosService.actualizarData conserva la
// que ya tenía.
export async function actualizarPropietario(id, propietario, fotoFile = null) {
    try {
        const formData = new FormData();
        formData.append("config", new Blob([JSON.stringify(propietario)], { type: "application/json" }));
        if (fotoFile instanceof File) {
            formData.append("foto", fotoFile, fotoFile.name);
        }

        const respuesta = await fetch(`${API_URL}/${id}`, { method: "PUT", body: formData });

        const cuerpo = await respuesta.json().catch(() => null);
        if (!respuesta.ok) {
            const error = new Error(cuerpo?.message || "Error al actualizar el propietario");
            error.status = respuesta.status;
            error.details = cuerpo?.details || null;
            throw error;
        }
        return cuerpo;
    }
    catch (error) {
        console.error("Error al actualizar el registro: ", error);
        throw error;
    }
}

export async function obtenerPropietarioPorId(id) {
    try {
        const respuesta = await fetch(`${API_URL}/${id}`);
        if (!respuesta.ok) throw new Error("Error al obtener el propietario");
        const json = await respuesta.json();
        return json;
    }
    catch (error) {
        console.error("Error en obtenerPropietarioPorId:", error);
        throw error;
    }
}

// PATCH /api/propietarios/{id} -- autoedición desde "Editar mis datos"
// (editar_perfil.html): solo campos de texto, nunca contraseña ni foto, y
// solo se pisan los que se manden (el backend conserva el resto tal cual).
export async function actualizarParcialPropietario(id, datos) {
    try {
        const respuesta = await fetch(`${API_URL}/${id}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(datos)
            });
        const cuerpo = await respuesta.json().catch(() => null);
        if (!respuesta.ok) {
            const error = new Error(cuerpo?.message || "Error al actualizar tus datos");
            error.status = respuesta.status;
            error.details = cuerpo?.details || null;
            throw error;
        }
        return cuerpo;
    }
    catch (error) {
        console.error("Error en actualizarParcialPropietario:", error);
        throw error;
    }
}
