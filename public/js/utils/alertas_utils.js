/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/alertas_utils.js
   Mismo patrón y mismos nombres que el frontend de escritorio (js/utils/
   alertas_utils.js ahí): un único punto para Toast/SweetAlert2 en vez de
   repetir Swal.fire({...}) suelto en cada controller. El estilo oscuro NO
   se decide aquí en JS (a diferencia de PC, que todavía revisa localStorage
   a mano) -- en mobile ya alcanza con las reglas CSS de
   ":root[data-theme='dark'] .swal2-popup" (ver base_style.css), porque
   tema_temprano.js siempre deja el atributo data-theme puesto ANTES de
   que se pinte nada, así que la hoja de estilos ya sabe qué tema toca.
   ========================================================================== */
export const COLOR_PRIMARIO = "#2D60A1";
export const COLOR_PELIGRO = "#CE4B45";
export const COLOR_EXITO = "#2E9E6B";
export const COLOR_SECUNDARIO = "#6B7789";

const swal = typeof window !== "undefined" ? window.Swal : null;

/* Toast compartido (esquina superior derecha, se pausa al pasar el mouse).
   El color de fondo en modo oscuro lo resuelve la clase "colored-toast",
   igual que en PC. */
export const Toast = swal
    ? swal.mixin({
        toast: true,
        position: "top-end",
        customClass: { popup: "colored-toast" },
        showClass: { popup: "animate__animated animate__backInRight" },
        hideClass: { popup: "animate__animated animate__backOutRight" },
        showConfirmButton: false,
        timer: 2600,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.onmouseenter = swal.stopTimer;
            toast.onmouseleave = swal.resumeTimer;
        },
    })
    : null;

export function mostrarToast(icono, titulo) {
    if (!Toast) { window.alert(titulo); return Promise.resolve(); }
    return Toast.fire({ icon: icono, title: titulo });
}

/* Punto de entrada genérico: aplica el azul institucional por defecto al
   botón de confirmar, pero cualquier opción explícita del llamador (icon,
   html, input, showCancelButton, etc.) se respeta tal cual -- reemplazo
   directo de "Swal.fire({...})". */
export function alertar(opciones) {
    if (!swal) { window.alert(opciones?.title || opciones?.text || ""); return Promise.resolve({ isConfirmed: true }); }
    return swal.fire({ confirmButtonColor: COLOR_PRIMARIO, ...opciones });
}

export function alertaExito(titulo, texto, opciones = {}) {
    return alertar({ icon: "success", title: titulo, text: texto, ...opciones });
}

export function alertaError(titulo, texto, opciones = {}) {
    return alertar({ icon: "error", title: titulo, text: texto, ...opciones });
}

export function alertaAdvertencia(titulo, texto, opciones = {}) {
    return alertar({ icon: "warning", title: titulo, text: texto, ...opciones });
}

export function alertaInfo(titulo, texto, opciones = {}) {
    return alertar({ icon: "info", title: titulo, text: texto, ...opciones });
}

/* Confirmación destructiva estándar (eliminar, cerrar sesión, etc.). */
export function confirmarEliminacion({
    titulo = "¿Estás seguro?",
    texto = "Esta acción no se puede deshacer.",
    textoConfirmar = "Sí, continuar",
    textoCancelar = "Cancelar",
} = {}) {
    return alertar({
        icon: "warning",
        title: titulo,
        text: texto,
        showCancelButton: true,
        confirmButtonColor: COLOR_PELIGRO,
        cancelButtonColor: COLOR_SECUNDARIO,
        confirmButtonText: textoConfirmar,
        cancelButtonText: textoCancelar,
    });
}

export function mostrarCargando(titulo = "Cargando...") {
    return alertar({ title: titulo, didOpen: () => swal?.showLoading(), allowOutsideClick: false, showConfirmButton: false });
}
