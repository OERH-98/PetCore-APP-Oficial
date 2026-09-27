/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/push_fcm_utils.js
   Push NATIVO (Android/iOS vía Capacitor, plugin @capacitor/push-notifications)
   -- canal totalmente aparte de push_utils.js (Web Push del navegador, que
   ni siquiera existe dentro de un WebView nativo: ver el error "este
   navegador no soporta notificaciones push" que se investigó antes). Acá se
   orquesta el plugin; las llamadas HTTP en sí viven en push_fcm_service.js.
   ========================================================================== */
import { registrarTokenPushNativo } from "../services/push_fcm_service.js";
import { DESTINO_POR_ENLACE } from "./notificaciones_enlaces_utils.js";

function obtenerPushNotifications() {
    if (!window.Capacitor?.isNativePlatform?.()) return null;
    return window.Capacitor.Plugins?.PushNotifications
        || window.Capacitor.registerPlugin?.("PushNotifications");
}

/* Pide el permiso del sistema -- se llama al ARRANCAR la app (ver
   index_controller.js), para que el diálogo nativo aparezca cuanto antes en
   vez de escondido varias pantallas después. No registra el token todavía
   (eso necesita sesión activa, ver activarPushNativo más abajo) -- acá solo
   se resuelve el permiso del sistema operativo. Si el usuario ya lo negó
   antes, no se le vuelve a preguntar (el propio sistema operativo ya no
   deja, de todos modos).
   ========================================================================== */
export async function pedirPermisoPushNativo() {
    const PushNotifications = obtenerPushNotifications();
    if (!PushNotifications) return;

    try {
        const estado = await PushNotifications.checkPermissions();
        if (estado.receive === "prompt" || estado.receive === "prompt-with-rationale") {
            await PushNotifications.requestPermissions();
        }
    } catch (error) {
        console.error("No se pudo pedir el permiso de notificaciones push:", error);
    }
}

/* Registra el token en el backend -- se llama con sesión YA activa
   (dashboard.html, la primera pantalla autenticada tanto justo después de
   iniciar sesión como al reabrir la app con una sesión guardada), así "se
   autoactive por cada login" queda cubierto solo, sin pedirle nada al
   usuario (nada de botón ni de pantalla de Preferencias). */
export async function activarPushNativo() {
    const PushNotifications = obtenerPushNotifications();
    if (!PushNotifications) return;

    try {
        const estado = await PushNotifications.checkPermissions();
        if (estado.receive === "denied") return; // ya dijo que no -- no insistir acá

        if (estado.receive !== "granted") {
            const pedido = await PushNotifications.requestPermissions();
            if (pedido.receive !== "granted") return;
        }

        await PushNotifications.addListener("registration", (token) => {
            const plataforma = /android/i.test(navigator.userAgent) ? "ANDROID" : "IOS";
            registrarTokenPushNativo(token.value, plataforma).catch(() => {
                // Ya se registra el error adentro del service -- acá no hay
                // nada más que hacer, es un intento silencioso de fondo.
            });
        });
        await PushNotifications.addListener("registrationError", (error) => {
            console.error("Error al registrar el dispositivo para push nativo:", error);
        });

        await PushNotifications.register();
    } catch (error) {
        console.error("No se pudo activar las notificaciones push nativas:", error);
    }
}

/* Al tocar una notificación push con la app cerrada/en 2do plano, navega a
   la página de esa categoría -- "enlace" (ver PushTokenFcmService.
   enviarATodos en el backend) es un CÓDIGO ("CITAS", "EXPEDIENTE"...), no
   una URL; se traduce con el mismo mapa que ya usa la campanita in-app (ver
   notificaciones_enlaces_utils.js). Se llama una sola vez, junto con
   activarPushNativo().

   OJO: esto asume que la app ya está abierta en alguna página dentro de
   pages/ (warm/en 2do plano) -- el destino es relativo ("citas.html"). Si
   la app estaba COMPLETAMENTE cerrada, Capacitor la arranca de nuevo desde
   index.html, que decide su propia navegación inicial (ver
   index_controller.js) antes de que este listener llegue a correr; ese
   caso de "abrir en frío desde una notificación" no queda cubierto todavía. */
export async function iniciarAperturaDeNotificacionesPush() {
    const PushNotifications = obtenerPushNotifications();
    if (!PushNotifications) return;

    try {
        await PushNotifications.addListener("pushNotificationActionPerformed", (accion) => {
            const codigo = accion.notification?.data?.enlace;
            const destino = DESTINO_POR_ENLACE[codigo];
            if (destino) window.location.href = destino.href;
        });
    } catch (error) {
        console.error("No se pudo preparar la apertura de notificaciones push:", error);
    }
}
