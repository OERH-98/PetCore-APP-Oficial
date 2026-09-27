/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/formato_utils.js
   Formato de fechas y dinero, badges de estado y plantillas HTML que se
   repetían sueltas en varios controllers (dashboard, citas, mascotas,
   facturas, mascota_detalle, notificaciones) -- centralizadas aquí en vez
   de cada controller reinventando su propio bloqueFecha()/badge()/etc.
   ========================================================================== */
import { escaparHtml } from "./html_utils.js";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function aFecha(iso) {
  const partes = String(iso).split("-").map(Number);
  return new Date(partes[0], partes[1] - 1, partes[2]);
}

export function fechaLarga(iso) {
  if (!iso) return "Sin fecha";
  const f = aFecha(iso);
  return f.getDate() + " de " + MESES_LARGO[f.getMonth()] + " de " + f.getFullYear();
}

export function fechaConDia(iso) {
  const f = aFecha(iso);
  return DIAS[f.getDay()] + " " + f.getDate() + " de " + MESES_LARGO[f.getMonth()];
}

export function edadTexto(iso) {
  if (!iso) return "Edad no registrada";
  const nac = aFecha(iso);
  const hoy = new Date();
  let meses = (hoy.getFullYear() - nac.getFullYear()) * 12 + (hoy.getMonth() - nac.getMonth());
  if (hoy.getDate() < nac.getDate()) meses--;
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  if (anios <= 0) return Math.max(resto, 0) + (resto === 1 ? " mes" : " meses");
  if (resto === 0) return anios + (anios === 1 ? " año" : " años");
  return anios + (anios === 1 ? " año " : " años ") + resto + (resto === 1 ? " mes" : " meses");
}

/* "Hoy" / "Mañana" / "En 3 días" / fecha larga a partir de cierto punto --
   usado por la pestaña de Notificaciones para que las citas próximas se
   sientan como avisos, no como una copia de la agenda. */
export function relativoDias(iso) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = aFecha(iso);
  const dias = Math.round((fecha - hoy) / 86400000);

  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  if (dias > 1 && dias <= 6) return "En " + dias + " días";
  return fechaLarga(iso);
}

export function esFutura(iso) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return aFecha(iso) >= hoy;
}

export function dinero(monto) {
  const n = Number(monto);
  return "$" + (Number.isFinite(n) ? n : 0).toFixed(2);
}

export function paramUrl(nombre) {
  return new URLSearchParams(window.location.search).get(nombre);
}

/* El backend serializa cit_fecha_cita como datetime ISO completo
   ("2026-08-20T00:00:00.000Z"), no como "yyyy-MM-dd" — se recorta aquí para
   poder reutilizar aFecha/esFutura/bloqueFecha tal como están. */
export function soloFecha(iso) {
  return iso ? String(iso).slice(0, 10) : iso;
}

/* =====================================================================
   ¿ES DÍA FERIADO?
   Recibe la lista de DiasFeriadosDTO tal como la trae GET /api/dias_feriados
   (dias_feriados_service.js) y una fecha "yyyy-MM-dd", y dice si cae en
   alguno de ellos. fer_fecha viaja igual que cit_fecha_cita (java.sql.Date
   serializado por Jackson como datetime ISO completo), de ahí soloFecha().
   Un feriado "recurrente" (fer_recurrente = 1, ej. Navidad) se repite cada
   año en el mismo mes/día sin importar el año registrado.
   ===================================================================== */
export function esFechaFeriado(feriados, fechaISO) {
  if (!fechaISO || !Array.isArray(feriados)) return false;
  const mesDia = fechaISO.slice(5, 10); // "MM-dd"

  return feriados.some(function (f) {
    const fechaFeriado = soloFecha(f.fer_fecha);
    if (!fechaFeriado) return false;
    if (fechaFeriado === fechaISO) return true;
    return Number(f.fer_recurrente) === 1 && fechaFeriado.slice(5, 10) === mesDia;
  });
}

/* Nombre completo del empleado a partir de los campos de relación que
   agrega el backend (nombreEmpleado + apellidoEmpleado), con un fallback
   vacío si la cita todavía no tiene veterinario asignado. */
export function nombreEmpleado(item) {
  const nombre = [item.nombreEmpleado, item.apellidoEmpleado].filter(Boolean).join(" ");
  return nombre || "";
}

/* Semáforo: verde = cerrado con éxito, naranja = por venir, rojo = problema */
export function claseBadge(estado) {
  const verde = ["Completada", "Confirmada", "Activo", "Vigente", "Pagada", "Realizado"];
  const naranja = ["Agendada", "Pendiente", "En Espera", "Hospitalizado", "Próxima", "En Consulta"];
  const rojo = ["Cancelada", "No Presentado", "Vencida", "Vencido", "Anulada", "Extraviado", "Fallecido"];
  if (verde.includes(estado)) return "badge pc-badge pc-badge-ok";
  if (naranja.includes(estado)) return "badge pc-badge pc-badge-aviso";
  if (rojo.includes(estado)) return "badge pc-badge pc-badge-critico";
  return "badge pc-badge";
}

export function badge(estado) {
  const texto = estado || "Sin estado";
  return '<span class="' + claseBadge(texto) + '">' + escaparHtml(texto) + "</span>";
}

export function bloqueFecha(iso) {
  const f = aFecha(iso);
  return '<div class="pc-registro-fecha"><span class="dia">' + f.getDate() +
    '</span><span class="mes">' + MESES[f.getMonth()] + "</span></div>";
}

/* Quita el shimmer de "esqueleto de carga" (ver .skeleton en base_style.css)
   de un elemento cuyo contenido se llenó con .textContent en vez de con
   .innerHTML -- los contenedores que se reemplazan por completo (innerHTML)
   no lo necesitan, ya se llevan el marcado del esqueleto por delante. */
export function quitarEsqueleto(el) {
  if (el) el.classList.remove("skeleton", "skeleton-texto", "skeleton-linea", "skeleton-circulo");
}

export function vacio(mensaje) {
  return '<div class="pc-vacio"><i class="fa-regular fa-folder-open"></i>' + mensaje + "</div>";
}

/* Mismo look que "vacio" pero para errores de conexión con el backend */
export function error(mensaje) {
  return '<div class="pc-vacio"><i class="fa-solid fa-triangle-exclamation"></i>' + mensaje + "</div>";
}

/* Retrato: usa la foto real de Cloudinary (mas_foto_url, la misma que sube
   el frontend de escritorio al registrar/editar una mascota) cuando exista
   y cargue bien; si la mascota no tiene foto o la URL falla, se cae a una
   foto de perrito de placeholder en vez de mostrar el ícono roto del
   navegador. Es un archivo local (no un servicio externo) para que sea
   siempre exactamente la misma foto en toda la app.
   BUG QUE ESTO CORRIGE: leía "mascota.mas_foto", un campo que el backend
   nunca manda (el DTO real expone "mas_foto_url") -- toda mascota con foto
   subida se veía igual con el placeholder genérico, nunca con su foto
   real. */
const FOTO_PLACEHOLDER = "../img/mascota_placeholder.png";

export function retrato(mascota, extra) {
  const clase = "pc-retrato " + (extra || "");
  const nombre = mascota.mas_nombre || "Mascota";
  const foto = mascota.mas_foto_url || FOTO_PLACEHOLDER;
  return '<div class="' + clase + '"><img src="' + escaparHtml(foto) + '" alt="Foto de ' + escaparHtml(nombre) +
    '" onerror="this.onerror=null;this.src=\'' + FOTO_PLACEHOLDER + '\';"></div>';
}
