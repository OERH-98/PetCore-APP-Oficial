/* ==========================================================================
   PetCore — Portal de Propietarios
   js/services/push_fcm_service.js
   Llamadas HTTP a /api/push_fcm -- ver PushTokenFcmController en
   API_PetCore. push_fcm_utils.js (plugin nativo @capacitor/push-notifications)
   usa este service en vez de hacer fetch() directo, igual que el resto de
   la app.
   ========================================================================== */
const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/push_fcm";

// POST /api/push_fcm/token -- upsert por (token, dueño actual), ver
// PushTokenFcmService.registrar en el backend.
export async function registrarTokenPushNativo(token, plataforma) {
    try {
        const respuesta = await fetch(`${API_URL}/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ token, plataforma })
        });

        if (!respuesta.ok) {
            console.error("Error al registrar el token de push nativo");
            throw new Error("No se pudo registrar el token de notificaciones push.");
        }
    }
    catch (error) {
        console.error("Error al registrar el token de push nativo:", error);
        throw error;
    }
}
