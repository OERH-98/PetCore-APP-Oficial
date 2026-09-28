/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/notificaciones_utils.js

   El badge de la barra inferior (visible en TODAS las páginas internas).
   Antes este archivo armaba un feed sintético comparando citas/vacunas/
   antiparasitarios/diagnósticos contra un registro de "ya visto" guardado
   en localStorage -- nunca sincronizaba entre dos dispositivos del mismo
   propietario y no existía una bandeja real en el servidor.

   Ahora TBL_NOTIFICACION_DESTINATARIO acepta propietarios (NOD_PRO_ID,
   además del NOD_EMP_ID que ya usaban los empleados -- ver
   NotificacionesService.nuevaNotificacionParaPropietario en el backend),
   así que el backend es la fuente de verdad del leído/no-leído: citas
   agendadas/confirmadas/canceladas, diagnósticos nuevos, ingreso/alta de
   hospitalización y evolución clínica durante un internamiento generan su
   notificación ahí directamente. Este archivo solo pinta el conteo.
   ========================================================================== */
import { obtenerSesion } from "./sesion_utils.js";

export function pintarBadgeNotificaciones(cantidad) {
  const badge = document.getElementById("pcBadgeNotificaciones");
  if (!badge) return;
  if (cantidad > 0) {
    badge.textContent = cantidad > 9 ? "9+" : String(cantidad);
    badge.classList.remove("d-none");
  } else {
    badge.classList.add("d-none");
  }
}

export async function actualizarBadgeNotificaciones() {
  const sesion = await obtenerSesion();
  if (!sesion || !sesion.pro_id) return;
  try {
    const { obtenerNoLeidasPorPropietario } = await import("../services/notificaciones_service.js");
    const noLeidas = await obtenerNoLeidasPorPropietario(sesion.pro_id);
    pintarBadgeNotificaciones(noLeidas.length);
  } catch (e) {
    console.warn("No se pudo actualizar el badge de notificaciones:", e);
  }
}
