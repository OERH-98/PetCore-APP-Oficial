/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/perfil_controller.js
   Controller de pages/perfil.html.
   Servicio usado: propietarios_service.js — el pro_id real viene de la
   sesión guardada en el login (login_controller.js), así que se pide
   directamente el propietario correspondiente, no la lista completa.
   ========================================================================== */
import { obtenerPropietarioPorId } from "../services/propietarios_service.js";
import { iniciarLayout, requerirSesion, fechaLarga, soloFecha, error as vacioError, vacio, quitarEsqueleto, escaparHtml } from "./utils.js";

async function iniciarPerfil() {
  const datos = document.getElementById("pcDatosPerfil");
  if (!datos) return;

  const sesion = await requerirSesion();
  if (!sesion) return;

  function quitarEsqueletosEncabezado() {
    quitarEsqueleto(document.getElementById("pcNombrePerfil"));
    quitarEsqueleto(document.getElementById("pcUsuarioPerfil"));
    quitarEsqueleto(document.querySelector(".pc-retrato"));
  }

  let propietario = null;
  try {
    propietario = await obtenerPropietarioPorId(sesion.pro_id);
  } catch (e) {
    datos.innerHTML = vacioError("No se pudo conectar con el servidor. Intenta más tarde.");
    quitarEsqueletosEncabezado();
    return;
  }

  if (!propietario) {
    datos.innerHTML = vacio("No se encontró información de tu perfil.");
    quitarEsqueletosEncabezado();
    return;
  }

  const nombre = document.getElementById("pcNombrePerfil");
  if (nombre) { nombre.textContent = propietario.pro_nombre + " " + propietario.pro_apellido; quitarEsqueleto(nombre); }

  const usuario = document.getElementById("pcUsuarioPerfil");
  if (usuario) { usuario.textContent = "@" + (propietario.pro_nombre_usuario || "usuario"); quitarEsqueleto(usuario); }

  const inicial = document.getElementById("pcInicialPerfil");
  if (inicial) {
    inicial.textContent = (propietario.pro_nombre || "").charAt(0) + (propietario.pro_apellido || "").charAt(0);
  }
  quitarEsqueleto(inicial ? inicial.closest(".pc-retrato") : null);

  // Foto de perfil real (pro_foto_url, subida a Cloudinary desde el
  // formulario de edición): si existe, se muestra en vez de las iniciales;
  // si la URL falla al cargar, se vuelve a mostrar el círculo de iniciales.
  const foto = document.getElementById("pcFotoPerfil");
  if (foto && inicial) {
    if (propietario.pro_foto_url) {
      foto.onerror = function () {
        foto.classList.add("d-none");
        inicial.classList.remove("d-none");
      };
      foto.alt = "Foto de perfil de " + (propietario.pro_nombre || "");
      foto.src = propietario.pro_foto_url;
      foto.classList.remove("d-none");
      inicial.classList.add("d-none");
    } else {
      foto.classList.add("d-none");
      inicial.classList.remove("d-none");
    }
  }

  const campos = [
    { etiqueta: "Nombres", valor: propietario.pro_nombre, icono: "fa-user" },
    { etiqueta: "Apellidos", valor: propietario.pro_apellido, icono: "fa-user" },
    { etiqueta: "Correo", valor: propietario.pro_correo, icono: "fa-envelope" },
    { etiqueta: "Teléfono móvil", valor: propietario.pro_telefono_movil, icono: "fa-mobile-screen" },
    { etiqueta: "DUI", valor: propietario.pro_dui || "No registrado", icono: "fa-id-card" },
    { etiqueta: "Dirección", valor: propietario.pro_lugar_residencia, icono: "fa-location-dot" },
    { etiqueta: "Cliente desde", valor: fechaLarga(soloFecha(propietario.pro_fecha_registro)), icono: "fa-calendar-check" }
  ];

  datos.innerHTML = campos.map(function (c) {
    return (
      '<div class="pc-registro align-items-center">' +
        '<div class="pc-registro-fecha d-flex align-items-center justify-content-center" style="height:44px">' +
          '<i class="fa-solid ' + c.icono + '"></i>' +
        "</div>" +
        '<div class="flex-grow-1">' +
          '<span class="pc-eyebrow d-block mb-1">' + c.etiqueta + "</span>" +
          '<p class="mb-0 fw-semibold">' + escaparHtml(c.valor || "No registrado") + "</p>" +
        "</div>" +
      "</div>"
    );
  }).join("");
}

document.addEventListener("DOMContentLoaded", async function () {
  iniciarLayout();

  const sesion = await requerirSesion();
  if (!sesion) return;

  iniciarPerfil();
});
