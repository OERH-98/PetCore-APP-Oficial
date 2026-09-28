/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/editar_perfil_controller.js
   Controller de pages/editar_perfil.html: autoedición de datos de contacto.
   Dos caminos según haga falta o no subir una foto nueva -- ninguno de los
   dos pide contraseña:
     - Solo texto -> PATCH /api/propietarios/{id} (actualizarParcialPropietario,
       PropietarioAutoedicionDTO en el backend: liviano, solo pisa lo que
       se manda).
     - Con foto nueva -> PUT /api/propietarios/{id} (actualizarPropietario,
       multipart -- el mismo endpoint que usa el frontend de escritorio),
       mandando el propietario completo ya cargado + los campos editados,
       para no perder pro_dui/pro_genero/pro_fecha_nac/etc. que ese PUT
       sobreescribe todos a la vez. Tampoco pide contraseña: si "config" no
       trae pro_contrasenia, el backend conserva la que ya tenía.
   ========================================================================== */
import { obtenerPropietarioPorId, actualizarParcialPropietario, actualizarPropietario } from "../services/propietarios_service.js";
import { iniciarLayout, requerirSesion, guardarSesion, obtenerSesion, quitarEsqueleto, mostrarToast } from "./utils.js";

let propietarioOriginal = null;
let fotoSeleccionada = null;

async function cargarDatosActuales(sesion) {
  const campos = {
    nombre: document.getElementById("pcEditNombre"),
    apellido: document.getElementById("pcEditApellido"),
    correo: document.getElementById("pcEditCorreo"),
    telefono: document.getElementById("pcEditTelefono"),
    dui: document.getElementById("pcEditDui"),
    direccion: document.getElementById("pcEditDireccion")
  };
  const retrato = document.getElementById("pcEditFotoRetrato");
  const preview = document.getElementById("pcEditFotoPreview");
  const inicial = document.getElementById("pcEditFotoInicial");

  let propietario = null;
  try {
    propietario = await obtenerPropietarioPorId(sesion.pro_id);
  } catch (e) {
    const error = document.getElementById("pcEditarPerfilError");
    if (error) {
      error.textContent = "No se pudo conectar con el servidor. Intenta más tarde.";
      error.classList.remove("d-none");
    }
    quitarEsqueleto(retrato);
    return;
  }

  propietarioOriginal = propietario;

  campos.nombre.value = propietario.pro_nombre || "";
  campos.apellido.value = propietario.pro_apellido || "";
  campos.correo.value = propietario.pro_correo || "";
  campos.telefono.value = propietario.pro_telefono_movil || "";
  campos.dui.value = propietario.pro_dui || "";
  campos.direccion.value = propietario.pro_lugar_residencia || "";
  Object.values(campos).forEach(quitarEsqueleto);

  // El correo solo se bloquea cuando la cuenta ya está vinculada con
  // Google (pro_google_vinculado) -- alguien con acceso solo por
  // usuario/contraseña sí puede corregir su propio correo. El backend
  // aplica exactamente esta misma regla en actualizarParcial().
  const correoBloqueado = !!propietario.pro_google_vinculado;
  campos.correo.readOnly = correoBloqueado;
  document.getElementById("pcEditCorreoIconoBloqueado")?.classList.toggle("d-none", !correoBloqueado);
  document.getElementById("pcEditCorreoAyudaBloqueado")?.classList.toggle("d-none", !correoBloqueado);

  if (inicial) inicial.textContent = (propietario.pro_nombre || "").charAt(0) + (propietario.pro_apellido || "").charAt(0);
  if (propietario.pro_foto_url && preview && inicial) {
    preview.onerror = function () {
      preview.classList.add("d-none");
      inicial.classList.remove("d-none");
    };
    preview.alt = "Foto de perfil de " + (propietario.pro_nombre || "");
    preview.src = propietario.pro_foto_url;
    preview.classList.remove("d-none");
    inicial.classList.add("d-none");
  }
  quitarEsqueleto(retrato);
}

function iniciarSelectorFoto() {
  const boton = document.getElementById("pcBtnCambiarFoto");
  const input = document.getElementById("pcInputFoto");
  const preview = document.getElementById("pcEditFotoPreview");
  const inicial = document.getElementById("pcEditFotoInicial");
  if (!boton || !input) return;

  boton.addEventListener("click", function () { input.click(); });

  input.addEventListener("change", function () {
    const archivo = input.files && input.files[0];
    if (!archivo) return;

    if (!archivo.type.startsWith("image/")) {
      mostrarToast("warning", "Elige un archivo de imagen válido.");
      input.value = "";
      return;
    }

    fotoSeleccionada = archivo;

    const lector = new FileReader();
    lector.onload = function () {
      preview.src = lector.result;
      preview.classList.remove("d-none");
      if (inicial) inicial.classList.add("d-none");
    };
    lector.readAsDataURL(archivo);
  });
}

function iniciarFormulario(sesion) {
  const form = document.getElementById("pcFormEditarPerfil");
  const boton = document.getElementById("pcBtnGuardarPerfil");
  const error = document.getElementById("pcEditarPerfilError");
  if (!form) return;

  const textoBotonOriginal = boton.innerHTML;

  form.addEventListener("submit", function (evento) {
    evento.preventDefault();
    evento.stopPropagation();

    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      const faltante = form.querySelector(":invalid");
      if (faltante) faltante.focus();
      return;
    }

    error.classList.add("d-none");
    boton.disabled = true;
    boton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando';

    const datosTexto = {
      pro_nombre: document.getElementById("pcEditNombre").value.trim(),
      pro_apellido: document.getElementById("pcEditApellido").value.trim(),
      pro_correo: document.getElementById("pcEditCorreo").value.trim(),
      pro_telefono_movil: document.getElementById("pcEditTelefono").value.trim(),
      // null (no "") si se deja vacío: el DTO valida el DUI con un patrón
      // exacto ("00000000-0"), así que un "" ahí rompería la validación en
      // vez de tratarse como "no tengo DUI todavía".
      pro_dui: document.getElementById("pcEditDui").value.trim() || null,
      pro_lugar_residencia: document.getElementById("pcEditDireccion").value.trim()
    };

    // Con foto nueva hace falta el PUT completo (multipart) para no perder
    // pro_dui/pro_genero/pro_fecha_nac/etc., que ese endpoint sobreescribe
    // todos a la vez -- por eso se parte de propietarioOriginal ya cargado.
    const promesa = fotoSeleccionada
      ? actualizarPropietario(sesion.pro_id, { ...propietarioOriginal, ...datosTexto }, fotoSeleccionada)
      : actualizarParcialPropietario(sesion.pro_id, datosTexto);

    promesa
      .then(async function (actualizado) {
        const sesionActual = (await obtenerSesion()) || {};
        guardarSesion({
          ...sesionActual,
          pro_nombre: actualizado.pro_nombre,
          pro_apellido: actualizado.pro_apellido,
          nombre: actualizado.pro_nombre + " " + actualizado.pro_apellido,
          correo: actualizado.pro_correo,
          pro_foto_url: actualizado.pro_foto_url
        });
        return mostrarToast("success", "Tus datos se actualizaron correctamente.");
      })
      .then(function () {
        window.location.href = "perfil.html";
      })
      .catch(function (err) {
        // El backend ya manda un mensaje claro y específico (correo/DUI
        // duplicado, correo bloqueado por tener acceso al portal, etc.) --
        // se prefiere sobre un mensaje genérico fijo.
        const mensaje = err?.message
          || (err?.details ? Object.values(err.details).join(" ") : "No se pudieron guardar los cambios. Intenta más tarde.");
        error.textContent = mensaje;
        error.classList.remove("d-none");
        boton.disabled = false;
        boton.innerHTML = textoBotonOriginal;
      });
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  iniciarLayout();

  const sesion = await requerirSesion();
  if (!sesion) return;

  cargarDatosActuales(sesion);
  iniciarSelectorFoto();
  iniciarFormulario(sesion);
});
