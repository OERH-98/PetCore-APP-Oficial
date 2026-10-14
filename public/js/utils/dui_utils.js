/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/dui_utils.js
   Formato ÚNICO de DUI en todo PetCore: 00000000-0 (8 dígitos, guion,
   1 dígito). El backend lo exige igual (@Pattern en los DTO de API_PetCore);
   acá se ayuda a la persona a escribirlo:
     - Solo entran dígitos: las letras y símbolos se descartan al escribir o pegar.
     - El guion se pone solo ("012345678" -> "01234567-8").
     - Al salir del campo se normaliza un valor que venía con otro formato.

   Uso: marcar el <input> con data-mascara="dui" y llamar una vez a
   iniciarMascaraDui() desde el controller de la página. Antes de validar/enviar,
   pasar el valor por normalizarDui().
   Es el mismo archivo que js/utils/dui_utils.js del frontend de escritorio: si
   cambia una regla, cambiarla en los dos y en los @Pattern de los DTO de API_PetCore.
   ========================================================================== */

export const REGEX_DUI = /^[0-9]{8}-[0-9]$/;
export const FORMATO_DUI = "00000000-0";

const SELECTOR_MASCARA = 'input[data-mascara="dui"]';

/** Texto parcial con el guion puesto. `borrando` evita re-agregar el guion al borrar hacia atrás. */
export function formatearDui(valor, { borrando = false } = {}) {
    const digitos = String(valor ?? "").replace(/\D/g, "").slice(0, 9);
    if (digitos.length > 8 || (digitos.length === 8 && !borrando)) {
        return digitos.slice(0, 8) + "-" + digitos.slice(8);
    }
    return digitos;
}

/**
 * Valor listo para validar/enviar: si es un DUI con 9 dígitos (con o sin guion/espacios) lo deja en 00000000-0;
 * cualquier otra cosa -- letras incluidas -- se devuelve recortada tal cual, para que falle la validación.
 */
export function normalizarDui(valor) {
    const texto = String(valor ?? "").trim();
    if (!texto) return "";
    if (/[^0-9\s-]/.test(texto)) return texto;
    const digitos = texto.replace(/\D/g, "");
    return digitos.length === 9 ? digitos.slice(0, 8) + "-" + digitos.slice(8) : texto;
}

export function esDuiValido(valor) {
    return REGEX_DUI.test(String(valor ?? ""));
}

function aplicarMascara(input, borrando) {
    const original = input.value;
    const formateado = formatearDui(original, { borrando });
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

/** Engancha la máscara a todos los input[data-mascara="dui"] de la página (presentes y futuros). */
export function iniciarMascaraDui() {
    if (mascaraIniciada) return;
    mascaraIniciada = true;

    document.addEventListener("input", function (evento) {
        const campo = evento.target;
        if (!(campo instanceof HTMLInputElement) || !campo.matches(SELECTOR_MASCARA)) return;
        const borrando = typeof evento.inputType === "string" && evento.inputType.startsWith("delete");
        aplicarMascara(campo, borrando);
    });

    // Un valor asignado por código (datos guardados antes con otro formato) no dispara "input":
    // se deja en 00000000-0 en cuanto la persona pasa por el campo.
    document.addEventListener("focusout", function (evento) {
        const campo = evento.target;
        if (!(campo instanceof HTMLInputElement) || !campo.matches(SELECTOR_MASCARA)) return;
        const normalizado = normalizarDui(campo.value);
        if (normalizado !== campo.value) campo.value = normalizado;
    });
}
