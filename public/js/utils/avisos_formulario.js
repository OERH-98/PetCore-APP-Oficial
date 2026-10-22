/* ==========================================================================
   PetCore App — js/utils/avisos_formulario.js
   Globos de validación propios (reemplazan al globito nativo del navegador).

   Cuando un formulario usa la validación nativa (required / pattern /
   type="email"...), el navegador muestra su globito genérico (con el
   idioma y los colores del sistema operativo, sin respetar el tema de la
   app) y, si el campo fue reemplazado por un calendario / hora / lista
   buscable (queda oculto con d-none), bloquea el envío sin decir nada.

   Este módulo escucha el evento "invalid" de todo el documento (una sola
   vez) y, en lugar del globito nativo, muestra un globo propio anclado al
   primer campo con problema, con la paleta del modo claro u oscuro. Si hay
   más campos pendientes los nombra, y los resalta en rojo hasta que se
   corrijan. No cambia ninguna regla: solo comunica la que ya existe.

   Para las validaciones hechas en JavaScript (campo vacío, demasiado largo,
   formato inválido...) se usa avisarCampo(elemento | id | [varios], mensaje):
   muestra el mismo globo, anclado al campo exacto, con su mensaje. Si recibe
   varios candidatos ancla el primero que esté vacío (o el primero).

   No depende de SweetAlert ni de ninguna otra librería.
   Un formulario puede excluirse con data-sin-aviso en el <form>.
   ========================================================================== */

let iniciado = false;
let pendientes = [];
let temporizador = null;

let globo = null;
let objetivoGlobo = null;
let objetivoControl = null;
let globoSinAncla = false;
let temporizadorOcultar = null;
let marcados = [];

const CLASE_MARCA = "pc-campo-invalido";
const MAX_NOMBRES_EXTRA = 4;
const SEGUNDOS_VISIBLE = 9;

/* ---------------------------------------------------------------- estilos */

function inyectarEstilos() {
    if (document.getElementById("ESTILO_GLOBO_VALIDACION")) return;
    const estilo = document.createElement("style");
    estilo.id = "ESTILO_GLOBO_VALIDACION";
    estilo.textContent = `
        /* Paleta de la app: sigue las variables del tema activo (tema_claro.css / tema_oscuro.css) */
        :root {
            --pc-globo-fondo: var(--pc-superficie, #ffffff);
            --pc-globo-texto: var(--pc-texto, #1f2937);
            --pc-globo-texto-suave: var(--pc-texto-suave, #6b7789);
            --pc-globo-borde: rgba(206, 75, 69, 0.45);
            --pc-globo-acento: var(--pc-critico, #ce4b45);
            --pc-globo-icono-texto: #ffffff;
            --pc-globo-sombra: 0 10px 28px rgba(28, 61, 107, 0.18), 0 2px 6px rgba(0, 0, 0, 0.08);
            --pc-campo-borde: var(--pc-critico, #ce4b45);
            --pc-campo-halo: rgba(206, 75, 69, 0.22);
        }
        :root[data-theme="dark"] {
            --pc-globo-borde: rgba(227, 114, 108, 0.55);
            --pc-globo-icono-texto: #10141b;
            --pc-globo-sombra: 0 10px 28px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.35);
            --pc-campo-halo: rgba(227, 114, 108, 0.25);
        }

        .pc-globo-validacion {
            position: fixed;
            z-index: 2147483000;
            box-sizing: border-box;
            max-width: min(340px, calc(100vw - 16px));
            min-width: 180px;
            display: flex;
            gap: 0.6rem;
            align-items: flex-start;
            padding: 0.7rem 0.85rem;
            border-radius: 0.65rem;
            border: 1px solid var(--pc-globo-borde);
            border-left: 4px solid var(--pc-globo-acento);
            background: var(--pc-globo-fondo);
            color: var(--pc-globo-texto);
            box-shadow: var(--pc-globo-sombra);
            font-family: inherit;
            font-size: 0.875rem;
            line-height: 1.35;
            text-align: left;
            opacity: 0;
            transform: translateY(-4px);
            transition: opacity 0.16s ease, transform 0.16s ease;
            pointer-events: none;
        }
        .pc-globo-validacion.pc-globo-visible { opacity: 1; transform: translateY(0); }
        .pc-globo-validacion.pc-globo-arriba { transform: translateY(4px); }
        .pc-globo-validacion.pc-globo-arriba.pc-globo-visible { transform: translateY(0); }

        .pc-globo-icono {
            flex: 0 0 auto;
            width: 1.4rem;
            height: 1.4rem;
            margin-top: 0.05rem;
            border-radius: 50%;
            background: var(--pc-globo-acento);
            color: var(--pc-globo-icono-texto);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 0.85rem;
            line-height: 1;
        }
        .pc-globo-cuerpo { min-width: 0; overflow-wrap: anywhere; }
        .pc-globo-titulo { font-weight: 600; }
        .pc-globo-extra { margin-top: 0.3rem; font-size: 0.8rem; color: var(--pc-globo-texto-suave); }

        .pc-globo-flecha {
            position: absolute;
            left: 20px;
            width: 12px;
            height: 12px;
            background: var(--pc-globo-fondo);
            border: 1px solid var(--pc-globo-borde);
            transform: rotate(45deg);
        }
        .pc-globo-validacion:not(.pc-globo-arriba) .pc-globo-flecha {
            top: -7px;
            border-right: 0;
            border-bottom: 0;
        }
        .pc-globo-validacion.pc-globo-arriba .pc-globo-flecha {
            bottom: -7px;
            border-left: 0;
            border-top: 0;
        }

        .${CLASE_MARCA} {
            border-color: var(--pc-campo-borde) !important;
            box-shadow: 0 0 0 0.2rem var(--pc-campo-halo) !important;
            outline: none;
        }

        @media (prefers-reduced-motion: reduce) {
            .pc-globo-validacion { transition: none; transform: none; }
        }
    `;
    document.head.appendChild(estilo);
}

/* ------------------------------------------------------------- utilidades */

function escaparHtml(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

function estaOculto(control) {
    if (control.type === "hidden") return true;
    return control.classList.contains("d-none") || control.getAttribute("aria-hidden") === "true"
        || control.offsetParent === null;
}

/** El elemento que la persona realmente ve para ese control (el propio, o el selector que lo reemplazó). */
function elementoVisible(control) {
    if (!estaOculto(control)) return control;
    if (control.id) {
        for (const sufijo of ["_VISUAL", "_BUSCAR"]) {
            const candidato = document.getElementById(control.id + sufijo);
            if (candidato) return candidato;
        }
    }
    let hermano = control.nextElementSibling;
    while (hermano) {
        if (!hermano.classList.contains("d-none") && hermano.offsetParent !== null) {
            return hermano.matches("input, select, textarea, button") ? hermano : (hermano.querySelector("input, button") || hermano);
        }
        hermano = hermano.nextElementSibling;
    }
    return control.parentElement || control;
}

function limpiarEtiqueta(texto) {
    return String(texto || "").replace(/\s+/g, " ").replace(/[\s*:]+$/g, "").trim();
}

/** Nombre legible del campo: etiqueta asociada, etiqueta del bloque, aria-label, placeholder, name o id. */
function nombreDelCampo(control) {
    const visible = elementoVisible(control);
    const candidatos = [];

    for (const el of [control, visible]) {
        if (el && el.id) {
            const etiqueta = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            if (etiqueta) candidatos.push(etiqueta.textContent);
        }
        if (el && el.labels && el.labels[0]) candidatos.push(el.labels[0].textContent);
    }

    // Etiqueta del mismo bloque (columna / grupo) cuando no hay for= explícito
    const bloque = control.closest(".col, [class*='col-'], .form-group, .mb-3, .mb-2, .mb-4, .my-2, .my-3, .my-4");
    if (bloque) {
        const etiqueta = bloque.querySelector("label, .form-label, h6");
        if (etiqueta) candidatos.push(etiqueta.textContent);
    }

    candidatos.push(
        control.getAttribute("aria-label"),
        visible && visible.getAttribute && visible.getAttribute("aria-label"),
        control.getAttribute("title"),
        control.getAttribute("placeholder"),
        visible && visible.getAttribute && visible.getAttribute("placeholder"),
        control.name
    );

    for (const c of candidatos) {
        const limpio = limpiarEtiqueta(c);
        if (limpio) return limpio;
    }
    return limpiarEtiqueta((control.id || "campo").replace(/_/g, " ").toLowerCase());
}

/** Frase corta que le dice a la persona qué hacer con ese campo (la parte principal del globo). */
function mensajeDelCampo(control) {
    const v = control.validity;
    const nombre = nombreDelCampo(control);
    const resaltado = `<strong>${escaparHtml(nombre)}</strong>`;
    const tipo = (control.type || "").toLowerCase();

    if (v.valueMissing) {
        if (control.tagName === "SELECT" || control.getAttribute("role") === "combobox") return `Selecciona una opción en ${resaltado}.`;
        if (tipo === "checkbox") return `Marca la casilla ${resaltado} para continuar.`;
        if (tipo === "radio") return `Elige una opción en ${resaltado}.`;
        if (tipo === "file") return `Adjunta un archivo en ${resaltado}.`;
        if (["date", "datetime-local", "month", "week"].includes(tipo)) return `Elige una fecha en ${resaltado}.`;
        if (tipo === "time") return `Elige una hora en ${resaltado}.`;
        return `Completa el campo ${resaltado}.`;
    }

    if (v.typeMismatch) {
        if (tipo === "email") {
            const valor = String(control.value || "").trim();
            if (!valor.includes("@")) return `Al correo le falta el «@». Ejemplo: <strong>nombre@correo.com</strong>`;
            if (valor.endsWith("@") || valor.startsWith("@")) return `Completa el correo en ambos lados del «@». Ejemplo: <strong>nombre@correo.com</strong>`;
            return `Revisa el formato del correo en ${resaltado}. Ejemplo: <strong>nombre@correo.com</strong>`;
        }
        if (tipo === "url") return `${resaltado}: escribe una dirección válida que empiece con https://`;
        return `${resaltado}: el valor no es válido.`;
    }
    if (v.patternMismatch) return `${resaltado}: ${escaparHtml(control.title || "no tiene el formato esperado.")}`;
    if (v.tooShort) return `${resaltado}: debe tener al menos ${control.minLength} caracteres.`;
    if (v.tooLong) return `${resaltado}: puede tener como máximo ${control.maxLength} caracteres.`;
    if (v.rangeUnderflow) return `${resaltado}: el valor mínimo es ${escaparHtml(control.min)}.`;
    if (v.rangeOverflow) return `${resaltado}: el valor máximo es ${escaparHtml(control.max)}.`;
    if (v.stepMismatch) return `${resaltado}: el valor no es válido.`;
    if (v.badInput) return `${resaltado}: el valor escrito no es válido.`;
    return `${resaltado}: ${escaparHtml(control.validationMessage || "el valor no es válido.")}`;
}

/* ------------------------------------------------------------------ marcas */

function quitarMarcas() {
    marcados.forEach(m => m.visible.classList.remove(CLASE_MARCA));
    marcados = [];
}

/** Marca en rojo el elemento visible. "control" es el campo original (puede estar oculto tras un selector). */
function marcar(visible, control) {
    if (!visible || !visible.classList) return;
    visible.classList.add(CLASE_MARCA);
    marcados.push({ visible, control: control || visible });
}

/** Quita la marca roja (y el globo) en cuanto la persona cambia ese campo, sea el visible o el original oculto. */
function limpiarMarcaDe(evento) {
    const t = evento.target;
    if (!(t instanceof Node)) return;
    if (marcados.length) {
        marcados = marcados.filter(m => {
            const afecta = t === m.visible || t === m.control || (m.visible.contains && m.visible.contains(t));
            if (afecta) m.visible.classList.remove(CLASE_MARCA);
            return !afecta;
        });
    }
    if (globo && objetivoGlobo && (t === objetivoGlobo || t === objetivoControl || (objetivoGlobo.contains && objetivoGlobo.contains(t)))) {
        ocultarGlobo();
    }
}

/** Al salir del campo, si el original ya tiene valor (lo completaron con un selector), deja de estar en rojo. */
function revisarMarcasAlSalir(evento) {
    const t = evento.target;
    if (!(t instanceof Node) || !marcados.length) return;
    marcados = marcados.filter(m => {
        const afecta = t === m.visible || t === m.control;
        if (afecta && m.control && typeof m.control.value === "string" && m.control.value.trim() !== "" &&
            m.control.checkValidity && m.control.validity.valueMissing === false && m.control.type !== "checkbox") {
            m.visible.classList.remove(CLASE_MARCA);
            return false;
        }
        return true;
    });
}

/* ------------------------------------------------------------------- globo */

function ocultarGlobo() {
    clearTimeout(temporizadorOcultar);
    temporizadorOcultar = null;
    const actual = globo;
    globo = null;
    objetivoGlobo = null;
    objetivoControl = null;
    globoSinAncla = false;
    if (!actual) return;
    actual.classList.remove("pc-globo-visible");
    setTimeout(() => actual.remove(), 180);
}

function posicionarGlobo() {
    if (!globo) return;
    if (!globoSinAncla && (!objetivoGlobo || !document.body.contains(objetivoGlobo))) {
        ocultarGlobo();
        return;
    }
    const margen = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = globoSinAncla ? { width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 } : objetivoGlobo.getBoundingClientRect();
    const ancho = globo.offsetWidth;
    const alto = globo.offsetHeight;
    const flecha = globo.querySelector(".pc-globo-flecha");

    // Sin posición medible (el contenedor también está oculto): arriba al centro, sin flecha
    if (r.width === 0 && r.height === 0) {
        globo.style.left = `${Math.max(margen, (vw - ancho) / 2)}px`;
        globo.style.top = `${margen + 8}px`;
        globo.classList.remove("pc-globo-arriba");
        if (flecha) flecha.style.display = "none";
        return;
    }
    if (flecha) flecha.style.display = "";

    let arriba = false;
    let top = r.bottom + 10;
    if (top + alto > vh - margen && r.top - alto - 10 > margen) {
        top = r.top - alto - 10;
        arriba = true;
    }
    top = Math.min(Math.max(margen, top), Math.max(margen, vh - alto - margen));

    const left = Math.min(Math.max(margen, r.left), Math.max(margen, vw - ancho - margen));
    const flechaX = Math.min(Math.max(14, r.left + Math.min(r.width / 2, 28) - left), Math.max(14, ancho - 26));

    globo.classList.toggle("pc-globo-arriba", arriba);
    globo.style.left = `${left}px`;
    globo.style.top = `${top}px`;
    if (flecha) flecha.style.left = `${flechaX}px`;
}

function mostrarGlobo(controles, opciones = {}) {
    inyectarEstilos();
    ocultarGlobo();
    quitarMarcas();

    const vistos = new Set();
    const unicos = [];
    controles.forEach(control => {
        const visible = elementoVisible(control);
        if (!vistos.has(visible)) {
            vistos.add(visible);
            unicos.push({ control, visible });
        }
    });
    if (!unicos.length && opciones.mensajeHtml === undefined) return;

    unicos.forEach(({ control, visible }) => marcar(visible, control));

    const primero = unicos[0] || { control: null, visible: null };
    const otros = opciones.mensajeHtml !== undefined ? [] : unicos.slice(1).map(u => nombreDelCampo(u.control));
    let extra = "";
    if (otros.length) {
        const mostrados = otros.slice(0, MAX_NOMBRES_EXTRA).map(escaparHtml).join(", ");
        const resto = otros.length - MAX_NOMBRES_EXTRA;
        extra = `<div class="pc-globo-extra">${otros.length === 1 ? "También falta" : `Faltan ${otros.length} campos más`}: ${mostrados}${resto > 0 ? ` y ${resto} más` : ""}.</div>`;
    }

    globo = document.createElement("div");
    globo.className = "pc-globo-validacion";
    globo.setAttribute("role", "alert");
    globo.innerHTML = `
        <span class="pc-globo-flecha" aria-hidden="true"></span>
        <span class="pc-globo-icono" aria-hidden="true">!</span>
        <div class="pc-globo-cuerpo">
            <div class="pc-globo-titulo">${opciones.mensajeHtml !== undefined ? opciones.mensajeHtml : mensajeDelCampo(primero.control)}</div>
            ${extra}
        </div>`;
    document.body.appendChild(globo);
    objetivoGlobo = primero.visible;
    objetivoControl = primero.control || null;
    globoSinAncla = !objetivoGlobo;

    if (objetivoGlobo) {
        try { objetivoGlobo.scrollIntoView({ block: "center", behavior: "auto" }); } catch (e) { /* sin scroll */ }
    }
    posicionarGlobo();
    requestAnimationFrame(() => globo && globo.classList.add("pc-globo-visible"));

    if (objetivoGlobo) {
        try { objetivoGlobo.focus({ preventScroll: true }); } catch (e) { /* no enfocable */ }
    }
    temporizadorOcultar = setTimeout(ocultarGlobo, SEGUNDOS_VISIBLE * 1000);
}

function procesarPendientes() {
    temporizador = null;
    const controles = pendientes;
    pendientes = [];
    if (controles.length) mostrarGlobo(controles);
}

let escuchasListas = false;

/** Escuchas comunes al globo (seguimiento al desplazarse, Esc, clic fuera). Idempotente. */
function iniciarEscuchasDelGlobo() {
    if (escuchasListas) return;
    escuchasListas = true;
    inyectarEstilos();

    // Cualquier cambio del campo marcado (o de su original oculto) limpia el rojo y el globo
    document.addEventListener("input", limpiarMarcaDe, true);
    document.addEventListener("change", limpiarMarcaDe, true);
    document.addEventListener("focusout", revisarMarcasAlSalir, true);

    // El globo sigue a su campo si la página o un panel se desplaza / cambia de tamaño
    window.addEventListener("scroll", posicionarGlobo, true);
    window.addEventListener("resize", posicionarGlobo);
    document.addEventListener("keydown", e => { if (e.key === "Escape") ocultarGlobo(); });
    document.addEventListener("pointerdown", e => {
        if (globo && !globo.contains(e.target) && e.target !== objetivoGlobo) ocultarGlobo();
    }, true);
}

function resolverControl(candidato) {
    if (!candidato) return null;
    if (typeof candidato === "string") {
        return document.getElementById(candidato) || document.querySelector(candidato);
    }
    return candidato instanceof HTMLElement ? candidato : null;
}

function estaVacio(control) {
    if (control.type === "checkbox" || control.type === "radio") return !control.checked;
    if (typeof control.value === "string") return control.value.trim() === "";
    return false;
}

/**
 * Muestra el globo de validación anclado al campo exacto, con el mensaje indicado.
 * Para validaciones hechas en JavaScript, en lugar de una alerta general.
 *
 * @param {HTMLElement|string|Array} objetivo  campo, su id, o varios candidatos: se ancla el primero vacío
 *                                              (si ninguno está vacío, el primero).
 * @param {string} mensaje                      texto plano que se muestra en el globo.
 * @returns {false} siempre false, para poder escribir: return avisarCampo(...)
 */
export function avisarCampo(objetivo, mensaje) {
    iniciarEscuchasDelGlobo();
    const candidatos = (Array.isArray(objetivo) ? objetivo : [objetivo]).map(resolverControl).filter(Boolean);
    // Un <input type="hidden"> (valor del selector) no se ve: se prefiere el campo visible que lo acompaña
    const visibles = candidatos.filter(c => c.type !== "hidden");
    const grupo = visibles.length ? visibles : candidatos;
    const elegido = grupo.find(estaVacio) || grupo[0] || null;
    mostrarGlobo(elegido ? [elegido] : [], { mensajeHtml: escaparHtml(mensaje) });
    return false;
}

if (typeof window !== "undefined") window.PetCoreAvisos = { avisarCampo };

export function iniciarAvisosFormulario() {
    if (iniciado) return;
    iniciado = true;
    iniciarEscuchasDelGlobo();

    // "invalid" no burbujea: se escucha en la fase de captura del documento
    document.addEventListener("invalid", function (evento) {
        const control = evento.target;
        if (!(control instanceof HTMLElement)) return;
        if (control.closest(".swal2-container")) return; // formularios dentro de un aviso ya validan por su cuenta
        const formulario = control.form;
        if (formulario && formulario.hasAttribute("data-sin-aviso")) return;

        evento.preventDefault(); // evita el globito nativo (y el bloqueo mudo de los campos ocultos)
        if (!pendientes.includes(control)) pendientes.push(control);
        if (!temporizador) temporizador = setTimeout(procesarPendientes, 0);
    }, true);
}
