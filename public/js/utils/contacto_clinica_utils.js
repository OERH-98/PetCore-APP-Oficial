/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/contacto_clinica_utils.js
   Teléfono de la clínica tomado de la CONFIGURACIÓN DEL SISTEMA (la misma que
   edita el administrador en el frontend de escritorio), no escrito a mano en
   las pantallas: si el admin cambia el número, la app lo muestra la próxima vez
   que se abre la pantalla.

   Cómo se usa en una página (login, recuperar contraseña, crear cuenta...):
     <span data-contacto-grupo class="d-none">
       al <a data-contacto="telefono"></a>
     </span>
   El grupo se muestra solo cuando hay un número; el <a> recibe el texto y el
   href "tel:". Con una configuración ya guardada se pinta al instante y luego
   se vuelve a pedir al servidor (GET /api/cfgs_sistema es público: sirve antes
   de iniciar sesión).
   ========================================================================== */
import { obtenerConfiguracionActual } from "../services/config_sistema_service.js";

const CLAVE_CONTACTO = "pc_contacto_clinica";

function leerContactoGuardado() {
  try {
    const texto = window.localStorage.getItem(CLAVE_CONTACTO);
    return texto ? JSON.parse(texto) : null;
  } catch (e) { return null; }
}

function guardarContacto(contacto) {
  try {
    window.localStorage.setItem(CLAVE_CONTACTO, JSON.stringify(contacto));
  } catch (e) { /* sin almacenamiento: se pedirá de nuevo */ }
}

// Teléfono fijo de la clínica; si no hay, su móvil.
function numeroDe(contacto) {
  if (!contacto) return "";
  return String(contacto.telefono || contacto.movil || "").trim();
}

function pintarContacto(contacto) {
  const numero = numeroDe(contacto);
  const llamable = numero.replace(/[^\d+]/g, "");

  document.querySelectorAll("[data-contacto-grupo]").forEach(function (grupo) {
    grupo.classList.toggle("d-none", !numero);
  });
  document.querySelectorAll('[data-contacto="telefono"]').forEach(function (enlace) {
    enlace.textContent = numero;
    if (llamable) enlace.setAttribute("href", "tel:" + llamable);
    else enlace.removeAttribute("href");
  });
}

export async function iniciarContactoClinica() {
  const guardado = leerContactoGuardado();
  if (guardado) pintarContacto(guardado);

  try {
    const configuracion = await obtenerConfiguracionActual();
    if (!configuracion) return;
    const contacto = {
      telefono: configuracion.sis_telefono_veterinaria || "",
      movil: configuracion.sis_movil_veterinaria || ""
    };
    guardarContacto(contacto);
    pintarContacto(contacto);
  } catch (e) {
    console.warn("No se pudo obtener el teléfono de la clínica:", e);
  }
}
