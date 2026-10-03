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

   Heartbeat + reconexión con espera creciente (ver el mismo archivo del
   frontend de escritorio para el detalle): el router de Heroku corta toda
   conexión sin tráfico a los 55 s, y en un celular además la red cambia
   (wifi <-> datos) o el equipo duerme sin que el navegador se entere. Se
   manda un "ping" de texto cada 25 s esperando "pong"; si no llega, se
   reconecta. Al volver a conectar se emite el evento sintético
   "WS_RECONECTADO" para que las páginas revaliden lo que se perdió.
   ========================================================================== */
const WS_URL = "wss://petcore-8afada45fabc.herokuapp.com/ws";

const INTERVALO_PING_MS = 25000;
const TIMEOUT_PONG_MS = 10000;
const REINTENTO_MIN_MS = 1000;
const REINTENTO_MAX_MS = 30000;

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
let temporizadorPing = null;
let temporizadorPong = null;
let temporizadorReintento = null;
let intentos = 0;
let yaConectoAntes = false;
const suscriptores = new Map(); // evento -> Set<callback>

function emitir(evento, datos) {
    const callbacks = suscriptores.get(evento);
    if (!callbacks) return;
    callbacks.forEach(cb => {
        try { cb(datos); } catch (error) { console.error(`[WS] Error en suscriptor de "${evento}":`, error); }
    });
}

function detenerHeartbeat() {
    clearInterval(temporizadorPing);
    clearTimeout(temporizadorPong);
    temporizadorPing = null;
    temporizadorPong = null;
}

function iniciarHeartbeat(sock) {
    detenerHeartbeat();
    temporizadorPing = setInterval(() => {
        if (sock !== socket || sock.readyState !== WebSocket.OPEN) return;
        try {
            sock.send("ping");
        } catch (error) {
            sock.close();
            return;
        }
        clearTimeout(temporizadorPong);
        temporizadorPong = setTimeout(() => {
            console.warn("[WS] Sin respuesta al ping, se reconecta");
            try { sock.close(); } catch (error) { /* ya cerrado */ }
        }, TIMEOUT_PONG_MS);
    }, INTERVALO_PING_MS);
}

function programarReintento() {
    clearTimeout(temporizadorReintento);
    const espera = Math.min(REINTENTO_MAX_MS, REINTENTO_MIN_MS * 2 ** intentos);
    intentos++;
    temporizadorReintento = setTimeout(conectar, espera * (0.75 + Math.random() * 0.5));
}

export function conectar() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return; // ya conectado o conectando, no duplicar
    }
    clearTimeout(temporizadorReintento);

    let sock;
    try {
        sock = new WebSocket(conMismoHost(WS_URL));
    } catch (error) {
        console.warn("[WS] No se pudo abrir la conexión:", error);
        programarReintento();
        return;
    }
    socket = sock;

    sock.addEventListener("open", () => {
        intentos = 0;
        iniciarHeartbeat(sock);
        if (yaConectoAntes) emitir("WS_RECONECTADO");
        yaConectoAntes = true;
    });

    sock.addEventListener("message", (mensaje) => {
        // Cualquier mensaje del servidor prueba que la conexión sigue viva.
        clearTimeout(temporizadorPong);
        if (mensaje.data === "pong") return;

        let cuerpo;
        try {
            cuerpo = JSON.parse(mensaje.data);
        } catch (error) {
            console.warn("[WS] Mensaje no es JSON válido:", error);
            return;
        }
        emitir(cuerpo.evento, cuerpo.datos);
    });

    // Un socket viejo que cierra tarde no debe pisar al nuevo.
    sock.addEventListener("close", () => {
        if (sock !== socket) return;
        detenerHeartbeat();
        programarReintento();
    });
    sock.addEventListener("error", () => {
        sock.close();
    });
}

// Al volver a la app (o recuperar la red) no tiene sentido esperar al
// siguiente reintento programado: se reconecta ya.
document.addEventListener("visibilitychange", () => {
    if (!document.hidden && (!socket || socket.readyState === WebSocket.CLOSED)) {
        intentos = 0;
        conectar();
    }
});
window.addEventListener("online", () => {
    if (!socket || socket.readyState === WebSocket.CLOSED) {
        intentos = 0;
        conectar();
    }
});

/** Cualquier controller de página puede suscribirse a un evento del
 *  backend (ver EventoWebSocketHandler.difundir) sin tener que manejar la
 *  conexión él mismo. Además existe el evento sintético "WS_RECONECTADO". */
export function suscribir(evento, callback) {
    if (!suscriptores.has(evento)) suscriptores.set(evento, new Set());
    suscriptores.get(evento).add(callback);
}
