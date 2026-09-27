/* ==========================================================================
   PetCore — Portal de Propietarios
   js/services/websocket_service.js
   Mismo patrón que el frontend de escritorio (js/services/websocket_service.js
   ahí): un socket de bajo nivel a /ws, sin STOMP ni salas -- el backend
   manda TODOS los eventos a TODAS las conexiones (EventoWebSocketHandler.
   difundir) y cada página decide, con suscribir(evento, cb), cuáles le
   importan. Para el portal de propietarios los eventos relevantes hoy son
   "CITA_ACTUALIZADA" (alta, edición o cambio de estado de una cita) y
   "NOTIFICACION_NUEVA" (nueva fila en TBL_NOTIFICACION_DESTINATARIO para
   este propietario) -- dashboard, citas y notificaciones se suscriben
   para refrescarse solas.
   ========================================================================== */
const WS_URL = "wss://petcore-8afada45fabc.herokuapp.com/ws";

// Mismo truco que fetch_con_credenciales.js/sesion_service.js, pero para el
// WebSocket: si esta página no se sirve desde "localhost" (Live Server en
// 127.0.0.1, o el celular de verdad entrando por la IP de la LAN -- el caso
// que de verdad importa en un portal "mobile"), "wss://petcore-8afada45fabc.herokuapp.com/ws"
// apunta a la propia máquina del cliente, no al backend, y el socket nunca
// llega a conectar. Sin la conexión, cada suscribir(evento, cb) se registra
// igual (no lanza error) pero nunca recibe nada del servidor -- el fondo
// institucional (y cualquier otro refresco en vivo) solo se ve actualizado
// al recargar la página entera, que sí vuelve a pedir todo por REST.
function conMismoHost(url) {
    return url.replace(/^(wss?:\/\/)(?:localhost|127\.0\.0\.1)(:8080\b)/, `$1${window.location.hostname}$2`);
}

let socket = null;
const suscriptores = new Map(); // evento -> Set<callback>

export function conectar() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return; // ya conectado o conectando, no duplicar
    }

    try {
        socket = new WebSocket(conMismoHost(WS_URL));
    } catch (error) {
        console.warn("[WS] No se pudo abrir la conexión:", error);
        return;
    }

    socket.addEventListener("message", (mensaje) => {
        let cuerpo;
        try {
            cuerpo = JSON.parse(mensaje.data);
        } catch (error) {
            console.warn("[WS] Mensaje no es JSON válido:", error);
            return;
        }
        const callbacks = suscriptores.get(cuerpo.evento);
        if (!callbacks) return;
        callbacks.forEach(cb => {
            try { cb(cuerpo.datos); } catch (error) { console.error(`[WS] Error en suscriptor de "${cuerpo.evento}":`, error); }
        });
    });

    // Reconexión simple: si el socket se cae (backend reiniciado, red
    // caída, etc.) se reintenta cada 3s hasta que vuelva a responder.
    socket.addEventListener("close", () => {
        setTimeout(conectar, 3000);
    });
    socket.addEventListener("error", () => {
        socket.close();
    });
}

/** Cualquier controller de página puede suscribirse a un evento del
 *  backend (ver EventoWebSocketHandler.difundir) sin tener que manejar la
 *  conexión él mismo. */
export function suscribir(evento, callback) {
    if (!suscriptores.has(evento)) suscriptores.set(evento, new Set());
    suscriptores.get(evento).add(callback);
}
