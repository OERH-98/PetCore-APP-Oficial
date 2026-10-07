/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/visor_pdf.js
   Visor de PDF DENTRO de la app (pantalla completa). Los WebView de Android/iOS no muestran un PDF dentro de un
   <iframe>/<embed> (solo lo descargan o abren otra app), así que cada página se dibuja con PDF.js en un <canvas>.
   Recibe los bytes ya generados (no descarga nada de internet salvo la propia librería PDF.js, igual que jsPDF).

   - "Atrás" del teléfono y la X cierran el visor (ver navegacion_atras.js -> window.__pcCerrarVisorPdf).
   - Botones +/- para acercar o alejar; con zoom mayor al ancho de pantalla se desplaza en horizontal.
   ========================================================================== */
const CDN_PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const CDN_PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let promesaPdfJs = null;

function cargarScript(src) {
    return new Promise((resolve, reject) => {
        const existente = document.querySelector(`script[src="${src}"]`);
        if (existente && existente.dataset.cargado === '1') { resolve(); return; }
        const script = existente || document.createElement('script');
        script.src = src;
        script.onload = () => { script.dataset.cargado = '1'; resolve(); };
        script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
        if (!existente) document.head.appendChild(script);
    });
}

function asegurarPdfJs() {
    if (!promesaPdfJs) {
        promesaPdfJs = (async () => {
            if (!window.pdfjsLib) await cargarScript(CDN_PDFJS);
            // Worker en otro origen (CDN): PDF.js lo envuelve solo en un blob, no hace falta nada más
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN_PDFJS_WORKER;
        })().catch((error) => { promesaPdfJs = null; throw error; });
    }
    return promesaPdfJs;
}

function crearElemento(etiqueta, clase, html) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (html) el.innerHTML = html;
    return el;
}

/**
 * Abre el visor.
 * @param {ArrayBuffer} bytes - contenido del PDF.
 * @param {Object} opciones
 * @param {string} [opciones.titulo]
 * @param {Function} [opciones.onCompartir] - si se da, aparece el botón de compartir en el visor.
 * @param {Function} [opciones.onDescargar] - si se da, aparece el botón de descargar en el visor.
 */
export async function abrirVisorPdf(bytes, { titulo = 'Documento', onCompartir, onDescargar } = {}) {
    if (document.querySelector('.pc-visor-pdf')) return;

    const visor = crearElemento('div', 'pc-visor-pdf');
    visor.setAttribute('role', 'dialog');
    visor.setAttribute('aria-label', titulo);

    const barra = crearElemento('div', 'pc-visor-pdf__barra');
    const cerrar = crearElemento('button', 'pc-visor-pdf__btn', '<i class="fa-solid fa-xmark"></i>');
    cerrar.type = 'button';
    cerrar.setAttribute('aria-label', 'Cerrar');
    const textoTitulo = crearElemento('div', 'pc-visor-pdf__titulo');
    textoTitulo.textContent = titulo;
    const acciones = crearElemento('div', 'pc-visor-pdf__acciones');
    const menos = crearElemento('button', 'pc-visor-pdf__btn', '<i class="fa-solid fa-magnifying-glass-minus"></i>');
    const mas = crearElemento('button', 'pc-visor-pdf__btn', '<i class="fa-solid fa-magnifying-glass-plus"></i>');
    menos.type = mas.type = 'button';
    menos.setAttribute('aria-label', 'Alejar');
    mas.setAttribute('aria-label', 'Acercar');
    acciones.append(menos, mas);
    if (onCompartir) {
        const b = crearElemento('button', 'pc-visor-pdf__btn', '<i class="fa-solid fa-share-nodes"></i>');
        b.type = 'button'; b.setAttribute('aria-label', 'Compartir PDF');
        b.addEventListener('click', () => onCompartir());
        acciones.append(b);
    }
    if (onDescargar) {
        const b = crearElemento('button', 'pc-visor-pdf__btn', '<i class="fa-solid fa-download"></i>');
        b.type = 'button'; b.setAttribute('aria-label', 'Descargar PDF');
        b.addEventListener('click', () => onDescargar());
        acciones.append(b);
    }
    barra.append(cerrar, textoTitulo, acciones);

    const cuerpo = crearElemento('div', 'pc-visor-pdf__cuerpo');
    const estado = crearElemento('div', 'pc-visor-pdf__estado', '<span class="spinner-border spinner-border-sm me-2"></span>Abriendo PDF...');
    cuerpo.appendChild(estado);
    visor.append(barra, cuerpo);
    document.body.appendChild(visor);
    document.documentElement.classList.add('pc-visor-pdf-abierto');

    function cerrarVisor() {
        visor.remove();
        document.documentElement.classList.remove('pc-visor-pdf-abierto');
        delete window.__pcCerrarVisorPdf;
    }
    window.__pcCerrarVisorPdf = cerrarVisor;
    cerrar.addEventListener('click', cerrarVisor);

    try {
        await asegurarPdfJs();
        // PDF.js transfiere el buffer al worker: se le pasa una copia para no dejar inutilizable el original
        const documento = await window.pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;

        let zoom = 1;
        const ZOOM_MIN = 1, ZOOM_MAX = 3, PASO = 0.5;

        async function dibujar() {
            const anchoBase = cuerpo.clientWidth - 16;
            const anchoObjetivo = anchoBase * zoom;
            const densidad = Math.min(window.devicePixelRatio || 1, 2);
            cuerpo.querySelectorAll('canvas').forEach((c) => c.remove());
            estado.remove();

            for (let n = 1; n <= documento.numPages; n++) {
                if (!document.body.contains(visor)) return;      // cerrado mientras se dibujaba
                const pagina = await documento.getPage(n);
                const base = pagina.getViewport({ scale: 1 });
                const escala = anchoObjetivo / base.width;
                const vista = pagina.getViewport({ scale: escala * densidad });
                const canvas = document.createElement('canvas');
                canvas.className = 'pc-visor-pdf__pagina';
                canvas.width = Math.floor(vista.width);
                canvas.height = Math.floor(vista.height);
                canvas.style.width = Math.floor(anchoObjetivo) + 'px';
                canvas.style.height = Math.floor(vista.height / densidad) + 'px';
                cuerpo.appendChild(canvas);
                await pagina.render({ canvasContext: canvas.getContext('2d'), viewport: vista }).promise;
            }
        }

        let dibujando = Promise.resolve();
        function redibujar() {
            dibujando = dibujando.then(dibujar).catch((e) => console.error('[VISOR PDF] Error al dibujar:', e));
        }
        mas.addEventListener('click', () => { if (zoom < ZOOM_MAX) { zoom += PASO; redibujar(); } });
        menos.addEventListener('click', () => { if (zoom > ZOOM_MIN) { zoom -= PASO; redibujar(); } });
        redibujar();
    } catch (error) {
        console.error('[VISOR PDF] No se pudo abrir el PDF:', error);
        estado.textContent = 'No se pudo abrir el PDF. Revisa tu conexión e intenta de nuevo, o usa Descargar.';
    }
}
