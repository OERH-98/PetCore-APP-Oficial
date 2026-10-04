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
import { obtenerPropietarioPorId, actualizarParcialPropietario, actualizarPropietario, desvincularGooglePropietario } from "../services/propietarios_service.js";
import { esAppNativa, obtenerIdTokenGoogleNativo } from "../services/login_service.js";
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
  document.getElementById("pcBtnDesvincularGoogle")?.classList.toggle("d-none", !correoBloqueado);
  document.getElementById("pcCardGoogle")?.classList.toggle("d-none", !correoBloqueado);

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

/* Desvincular la cuenta de Google para poder cambiar el correo -- en un apartado propio de la pantalla (no en un
   cuadro emergente). Dos variantes según la cuenta:
   - Con contraseña propia: se pide la contraseña actual.
   - Solo con Google: se crea una contraseña (para no quedarse sin forma de entrar) y se confirma con Google
     (re-login con la misma cuenta). Esto último solo existe en la app nativa. */
function iniciarDesvincularGoogle(sesion) {
  const tarjeta = document.getElementById("pcCardGoogle");
  const botonAbrir = document.getElementById("pcBtnAbrirDesvincular");
  const botonIrDesdeCorreo = document.getElementById("pcBtnDesvincularGoogle");
  const form = document.getElementById("pcFormDesvincular");
  const error = document.getElementById("pcDesvError");
  const bloqueContrasenia = document.getElementById("pcDesvConContrasenia");
  const bloqueSoloGoogle = document.getElementById("pcDesvSoloGoogle");
  const inputContrasenia = document.getElementById("pcDesvContrasenia");
  const inputNueva = document.getElementById("pcDesvNueva");
  const inputConfirma = document.getElementById("pcDesvConfirma");
  const botonConfirmar = document.getElementById("pcBtnConfirmarDesvincular");
  const botonCancelar = document.getElementById("pcBtnCancelarDesvincular");
  if (!tarjeta || !form) return;

  const tieneContrasenia = () => !!(propietarioOriginal && propietarioOriginal.pro_tiene_contrasenia);

  function mostrarError(mensaje) {
    error.textContent = mensaje;
    error.classList.remove("d-none");
  }

  function abrirFormulario() {
    error.classList.add("d-none");
    form.classList.remove("was-validated");
    bloqueContrasenia.classList.toggle("d-none", !tieneContrasenia());
    bloqueSoloGoogle.classList.toggle("d-none", tieneContrasenia());
    botonConfirmar.textContent = tieneContrasenia() ? "Desvincular" : "Continuar con Google";
    form.classList.remove("d-none");
    botonAbrir.classList.add("d-none");
    tarjeta.scrollIntoView({ behavior: "smooth", block: "center" });
    (tieneContrasenia() ? inputContrasenia : inputNueva).focus();
  }

  function cerrarFormulario() {
    form.reset();
    form.classList.add("d-none");
    form.classList.remove("was-validated");
    error.classList.add("d-none");
    inputConfirma.setCustomValidity("");
    botonAbrir.classList.remove("d-none");
  }

  botonAbrir.addEventListener("click", abrirFormulario);
  botonCancelar.addEventListener("click", cerrarFormulario);
  // Desde el aviso del campo de correo: lleva al apartado y lo abre
  if (botonIrDesdeCorreo) {
    botonIrDesdeCorreo.addEventListener("click", function () {
      tarjeta.classList.remove("d-none");
      abrirFormulario();
    });
  }

  form.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    evento.stopPropagation();
    error.classList.add("d-none");

    let datos = null;

    if (tieneContrasenia()) {
      if (!inputContrasenia.value) {
        form.classList.add("was-validated");
        inputContrasenia.focus();
        return;
      }
      datos = { contrasenia: inputContrasenia.value };
    } else {
      if (!esAppNativa()) {
        mostrarError("Para desvincular tu cuenta de Google usa la app instalada en tu teléfono.");
        return;
      }
      inputConfirma.setCustomValidity(inputNueva.value === inputConfirma.value ? "" : "No coinciden");
      if (!form.checkValidity() || inputNueva.value.length < 8) {
        form.classList.add("was-validated");
        (inputNueva.value.length < 8 ? inputNueva : inputConfirma).focus();
        return;
      }
    }

    const textoOriginal = botonConfirmar.innerHTML;
    botonConfirmar.disabled = true;
    botonCancelar.disabled = true;
    botonConfirmar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando';

    try {
      if (!datos) {
        // Re-login con la MISMA cuenta de Google: demuestra que es la dueña del enlace
        let idToken = null;
        try {
          idToken = await obtenerIdTokenGoogleNativo();
        } catch (e) { /* se maneja abajo */ }
        if (!idToken) {
          mostrarError("No se pudo confirmar con Google. Intenta de nuevo.");
          return;
        }
        datos = { idToken: idToken, contraseniaNueva: inputNueva.value };
      }

      await desvincularGooglePropietario(sesion.pro_id, datos);

      // Listo: el correo queda editable y el apartado desaparece
      if (propietarioOriginal) {
        propietarioOriginal.pro_google_vinculado = false;
        propietarioOriginal.pro_tiene_contrasenia = true;
      }
      cerrarFormulario();
      tarjeta.classList.add("d-none");
      const correo = document.getElementById("pcEditCorreo");
      correo.readOnly = false;
      document.getElementById("pcEditCorreoIconoBloqueado")?.classList.add("d-none");
      document.getElementById("pcEditCorreoAyudaBloqueado")?.classList.add("d-none");
      mostrarToast("success", "Cuenta de Google desvinculada. Ya puedes cambiar tu correo.");
      correo.scrollIntoView({ behavior: "smooth", block: "center" });
      correo.focus();
    } catch (err) {
      mostrarError(err?.message || "No se pudo desvincular la cuenta de Google.");
    } finally {
      botonConfirmar.disabled = false;
      botonCancelar.disabled = false;
      botonConfirmar.innerHTML = textoOriginal;
    }
  });
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
  iniciarDesvincularGoogle(sesion);
});
