/* ==========================================================================
   Frontend-Mobile-Edition — sw.js (raíz del sitio a propósito, mismo motivo
   que el equivalente en Frontend-PETCORE: el scope de un service worker no
   puede ser más amplio que la carpeta donde vive el archivo).
   ========================================================================== */

self.addEventListener("push", (evento) => {
    let datos = { titulo: "PetCore", mensaje: "", enlace: "/" };
    try {
        if (evento.data) datos = evento.data.json();
    } catch (error) {
        console.warn("[sw] Payload de push no era JSON válido:", error);
    }

    // Relativo a self.location -- mismo motivo que en Frontend-PETCORE/sw.js.
    const icono = new URL("img/logo_relleno.svg", self.location).href;
    const opciones = {
        body: datos.mensaje || "",
        icon: icono,
        badge: icono,
        data: { enlace: datos.enlace || "/" }
    };

    evento.waitUntil(self.registration.showNotification(datos.titulo || "PetCore", opciones));
});

self.addEventListener("notificationclick", (evento) => {
    evento.notification.close();
    const enlace = (evento.notification.data && evento.notification.data.enlace) || "/";

    evento.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((listaClientes) => {
            for (const cliente of listaClientes) {
                if (cliente.url.includes(enlace) && "focus" in cliente) return cliente.focus();
            }
            if (clients.openWindow) return clients.openWindow(enlace);
        })
    );
});
