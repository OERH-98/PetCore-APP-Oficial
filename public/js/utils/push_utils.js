/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/push_utils.js
   Mismo mecanismo que su equivalente en Frontend-PETCORE: Web Push + Service
   Worker en la raíz del sitio (../sw.js desde pages/, ver sw.js) para que su
   scope cubra toda la app. El backend resuelve el pro_id de la cookie de
   sesión (authTokenPropietario), nunca del cliente.

   Las llamadas HTTP en sí viven en push_service.js (igual que el resto de
   la app: los fetch() a la API van en services, nunca en utils/controllers),
   este archivo solo orquesta el Service Worker/PushManager del navegador.
   ========================================================================== */
import { obtenerLlavePublicaPush, registrarSuscripcionPush, suscripcionActivaParaMi, eliminarSuscripcionPush } from "../services/push_service.js";

// Mismo cálculo que su equivalente en Frontend-PETCORE: sw.js vive en la
// raíz del sitio, y resolverlo relativo a import.meta.url (en vez de un
// "/sw.js" absoluto) funciona igual tanto en este XAMPP local (donde
// Frontend-Mobile-Edition es una subcarpeta de htdocs) como en producción.
const RAIZ_APP = new URL("../../", import.meta.url);
const SW_URL = new URL("sw.js", RAIZ_APP).href;

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

export function soportaPush() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// OJO: una suscripción es del NAVEGADOR, no de "el usuario" en abstracto --
// si dos propietarios comparten el mismo celular/tablet de la sala de
// espera, el navegador solo tiene UN PushSubscription (un endpoint) para
// todos ellos, pero el backend guarda una fila POR CADA propietario que se
// suscribió con ese endpoint (ver PushSuscripcionService.suscribir: upsert
// por endpoint + dueño actual, no por endpoint solo). Así que si el
// endpoint ya existe en el dispositivo pero todavía no hay fila para QUIEN
// está logueado ahora, se registra una nueva -- sin tocarle la suya a nadie
// más que ya estuviera suscrito en este dispositivo.
export async function tieneNotificacionesPushActivas() {
    if (!soportaPush()) return false;
    try {
        const registro = await navigator.serviceWorker.getRegistration(RAIZ_APP.href);
        if (!registro) return false;
        const suscripcion = await registro.pushManager.getSubscription();
        if (!suscripcion) return false;

        if (await suscripcionActivaParaMi(suscripcion.endpoint)) return true;

        const json = suscripcion.toJSON();
        await registrarSuscripcionPush({
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
            userAgent: navigator.userAgent
        });
        return true;
    } catch {
        return false;
    }
}

export async function activarNotificacionesPush() {
    if (!soportaPush()) {
        return { ok: false, motivo: "Este navegador no soporta notificaciones push." };
    }

    try {
        const registro = await navigator.serviceWorker.register(SW_URL, { scope: RAIZ_APP.href });

        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") {
            return { ok: false, motivo: "No se concedió el permiso de notificaciones." };
        }

        let suscripcion = await registro.pushManager.getSubscription();
        if (!suscripcion) {
            const publicKey = await obtenerLlavePublicaPush();

            suscripcion = await registro.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });
        }

        const json = suscripcion.toJSON();
        await registrarSuscripcionPush({
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
            userAgent: navigator.userAgent
        });

        return { ok: true };
    } catch (error) {
        console.error("No se pudo activar las notificaciones push:", error);
        return { ok: false, motivo: "Ocurrió un error al activar las notificaciones." };
    }
}

/**
 * Da de baja las notificaciones push en ESTE dispositivo PARA QUIEN está
 * logueado ahora: borra su fila en el backend y, únicamente si esa era la
 * ÚLTIMA fila de este endpoint (ningún otro propietario sigue suscrito en
 * este mismo dispositivo), cancela también la suscripción real del
 * PushManager del navegador -- esa sí es una sola por dispositivo/origen,
 * compartida por todos, así que cancelarla de golpe mientras alguien más la
 * sigue usando le cortaría el push a él también. Mismo mecanismo que su
 * equivalente en Frontend-PETCORE. Devuelve {ok, motivo} en vez de lanzar.
 */
export async function desactivarNotificacionesPush() {
    if (!soportaPush()) {
        return { ok: false, motivo: "Este navegador no soporta notificaciones push." };
    }

    try {
        const registro = await navigator.serviceWorker.getRegistration(RAIZ_APP.href);
        const suscripcion = await registro?.pushManager.getSubscription();

        if (!suscripcion) {
            return { ok: true };
        }

        const eraUltimaSuscripcion = await eliminarSuscripcionPush(suscripcion.endpoint);
        if (eraUltimaSuscripcion) {
            await suscripcion.unsubscribe();
        }

        return { ok: true };
    } catch (error) {
        console.error("No se pudo desactivar las notificaciones push:", error);
        return { ok: false, motivo: "Ocurrió un error al desactivar las notificaciones." };
    }
}
