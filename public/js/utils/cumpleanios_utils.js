/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/cumpleanios_utils.js
   Felicita al propietario si hoy es su cumpleaños y avisa si hoy cumple años alguna de sus mascotas. Se muestra UNA
   vez por día (se recuerda en localStorage). La comparación es solo mes-día sobre la fecha tal cual viene de la API
   (yyyy-MM-dd), así no hay corrimientos por zona horaria. Quien nace un 29 de febrero se felicita el 28 en años
   no bisiestos.
   ========================================================================== */
import { alertar } from "./alertas_utils.js";
import { escaparHtml } from "./html_utils.js";

function dos(n) { return String(n).padStart(2, "0"); }

function esBisiesto(anio) {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

function coincideHoy(fechaISO, hoy) {
  if (!fechaISO) return false;
  const md = String(fechaISO).slice(5, 10); // "MM-DD"
  const hoyMD = dos(hoy.getMonth() + 1) + "-" + dos(hoy.getDate());
  if (md === "02-29" && !esBisiesto(hoy.getFullYear())) return hoyMD === "02-28";
  return md === hoyMD;
}

function aniosCumplidos(fechaISO, hoy) {
  const nacimiento = Number(String(fechaISO).slice(0, 4));
  return nacimiento ? hoy.getFullYear() - nacimiento : null;
}

/**
 * @param {{proId: number, nombre: string, fechaNac: string|null, mascotas: Object[]}} datos
 */
export async function felicitarCumpleanios({ proId, nombre, fechaNac, mascotas }) {
  const hoy = new Date();
  const hoyISO = hoy.getFullYear() + "-" + dos(hoy.getMonth() + 1) + "-" + dos(hoy.getDate());
  const clave = "pc_cumple_felicitado_" + proId;

  try {
    if (window.localStorage.getItem(clave) === hoyISO) return; // ya se mostró hoy
  } catch (e) { /* sin localStorage: se muestra igual */ }

  const lineas = [];
  let esCumpleDelPropietario = false;

  if (coincideHoy(fechaNac, hoy)) {
    esCumpleDelPropietario = true;
    lineas.push("🎂 <strong>¡Feliz cumpleaños, " + escaparHtml(nombre) + "!</strong><br>Todo el equipo de PetCore te desea un día muy especial.");
  }

  (mascotas || []).forEach(function (m) {
    if (!coincideHoy(m.mas_fecha_nac, hoy)) return;
    const anios = aniosCumplidos(m.mas_fecha_nac, hoy);
    const textoAnios = anios && anios > 0 ? " Cumple " + anios + (anios === 1 ? " año." : " años.") : "";
    lineas.push("🐾 <strong>¡Hoy es el cumpleaños de " + escaparHtml(m.mas_nombre) + "!</strong>" + textoAnios + "<br>¡Dale un mimo extra de nuestra parte!");
  });

  if (!lineas.length) return;

  try { window.localStorage.setItem(clave, hoyISO); } catch (e) { /* ignorar */ }

  await alertar({
    title: esCumpleDelPropietario ? "¡Feliz cumpleaños!" : "¡Cumpleaños de tu mascota!",
    html: lineas.map(function (l) { return '<p class="mb-3">' + l + "</p>"; }).join(""),
    confirmButtonText: "¡Gracias!",
    showClass: { popup: "animate__animated animate__bounceIn" }
  });
}
