/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/telefono_utils.js
   Formato ÚNICO de teléfono en todo PetCore: 0000-0000 (4 dígitos, guion,
   4 dígitos). El backend lo exige igual (@Pattern en los DTO de API_PetCore); acá se
   ayuda a la persona a escribirlo:
     - El guion se pone solo mientras escribe o pega ("70001234" -> "7000-1234",
       "+503 7000-1234" -> "7000-1234"). Solo entran dígitos.
     - Al salir del campo se normaliza el valor que venía de la base de datos
       con otro formato (por ejemplo 8 dígitos seguidos).

   Uso: marcar el <input> con data-mascara="telefono" y llamar una vez a
   iniciarMascaraTelefono() desde el controller de la página. Antes de
   validar/enviar, pasar el valor por normalizarTelefono().
   Es el mismo archivo que js/utils/telefono_utils.js del frontend de
   escritorio: si cambia una regla, cambiarla en los dos y en los @Pattern de los DTO de API_PetCore.
   ========================================================================== */

export const REGEX_TELEFONO = /^[0-9]{4}-[0-9]{4}$/;
export const FORMATO_TELEFONO = "0000-0000";

const SELECTOR_MASCARA = 'input[data-mascara="telefono"]';

/** Todos los dígitos del texto, sin separadores y sin el código de país 503 si viene completo (503 + 8 dígitos). */
function extraerDigitosCompletos(valor) {
    let digitos = String(valor ?? "").replace(/\D/g, "");
    if (digitos.length === 11 && digitos.startsWith("503")) digitos = digitos.slice(3);
    return digitos;
}

/** Texto parcial con el guion puesto. `borrando` evita re-agregar el guion al borrar hacia atrás. */
export function formatearTelefono(valor, { borrando = false } = {}) {
    const digitos = extraerDigitosCompletos(valor).slice(0, 8);
    if (digitos.length > 4 || (digitos.length === 4 && !borrando)) {
        return digitos.slice(0, 4) + "-" + digitos.slice(4);
    }
    return digitos;
}

/** Valor listo para validar/enviar: si trae exactamente 8 dígitos lo deja en 0000-0000; si no, lo devuelve recortado. */
export function normalizarTelefono(valor) {
    const texto = String(valor ?? "").trim();
    if (!texto) return "";
    // Con letras u otros símbolos no se "arregla" nada: se deja tal cual para que falle la validación.
    if (/[^0-9\s+()-]/.test(texto)) return texto;
    // Sin recortar: un número con más (o menos) de 8 dígitos no se "arregla" a la fuerza, se deja para que falle la validación.
    const digitos = extraerDigitosCompletos(texto);
    return digitos.length === 8 ? digitos.slice(0, 4) + "-" + digitos.slice(4) : texto;
}

export function esTelefonoValido(valor) {
    return REGEX_TELEFONO.test(String(valor ?? ""));
}

function aplicarMascara(input, borrando) {
    const original = input.value;
    const formateado = formatearTelefono(original, { borrando });
    if (formateado === original) return;

    const posicion = input.selectionStart ?? original.length;
    const alFinal = posicion >= original.length;
    const digitosAntes = original.slice(0, posicion).replace(/\D/g, "").length;

    input.value = formateado;

    let nueva = formateado.length;
    if (!alFinal) {
        nueva = 0;
        let contados = 0;
        while (nueva < formateado.length && contados < digitosAntes) {
            if (/\d/.test(formateado[nueva])) contados++;
            nueva++;
        }
    }
    try { input.setSelectionRange(nueva, nueva); } catch (e) { /* tipo de input sin selección: se queda al final */ }
}

let mascaraIniciada = false;

/** Engancha la máscara a todos los input[data-mascara="telefono"] de la página (presentes y futuros). */
export function iniciarMascaraTelefono() {
    if (mascaraIniciada) return;
    mascaraIniciada = true;

    document.addEventListener("input", function (evento) {
        const campo = evento.target;
        if (!(campo instanceof HTMLInputElement) || !campo.matches(SELECTOR_MASCARA)) return;
        const borrando = typeof evento.inputType === "string" && evento.inputType.startsWith("delete");
        aplicarMascara(campo, borrando);
    });

    // Un valor asignado por código (datos guardados antes con otro formato) no dispara "input":
    // se deja en 0000-0000 en cuanto la persona pasa por el campo.
    document.addEventListener("focusout", function (evento) {
        const campo = evento.target;
        if (!(campo instanceof HTMLInputElement) || !campo.matches(SELECTOR_MASCARA)) return;
        const normalizado = normalizarTelefono(campo.value);
        if (normalizado !== campo.value) campo.value = normalizado;
    });
}
