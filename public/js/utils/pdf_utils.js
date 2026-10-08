/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/pdf_utils.js
   Generación de PDF a partir de un elemento del DOM -- usada por facturas
   (Mis facturas > Descargar). Mismo motor que su equivalente en
   Frontend-PETCORE.

   Estrategia: NO es una captura de pantalla ni el diálogo de impresión del
   navegador. Se recorre el elemento ya renderizado y se traduce su
   estructura a contenido vectorial real de jsPDF -- <table> se dibuja con
   jsPDF-AutoTable, y el resto (títulos, pares "etiqueta: valor", párrafos)
   como texto directo. Así el PDF se ve como un comprobante formal de
   verdad, no como una captura de la pantalla del celular.

   Como todo es texto/vectores (nada de imágenes de la página), el color no
   depende de qué tema tenga el celular en ese momento -- los colores del
   PDF los define este archivo, no se heredan del CSS.
   ========================================================================== */

const CDN_JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const CDN_AUTOTABLE = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';

// Resuelto relativo a ESTE archivo (no un "/" absoluto): mismo cálculo que
// ya usa push_utils.js para sw.js, para que funcione igual en el XAMPP
// local (subcarpeta de htdocs) y en producción.
const RAIZ_APP = new URL('../../', import.meta.url);
const RUTA_LOGO = new URL('img/logo.svg', RAIZ_APP).href;

// Paleta de marca (mismos tonos que el resto del sistema)
const COLOR_AZUL_OSCURO = [0, 51, 96];    // #003360 -- títulos
const COLOR_AZUL_MEDIO = [0, 72, 131];    // #004883 -- línea del membrete, cabecera de tablas
const COLOR_TEXTO = [33, 37, 41];         // texto normal
const COLOR_GRIS_META = [108, 117, 125];  // texto secundario (fecha, pie, etiquetas)
const COLOR_GRIS_LINEA = [222, 226, 230]; // línea del pie

// Geometría del membrete/pie, en puntos (A4 = 595.28 x 841.89 pt)
const MARGEN = 36;
const ENCABEZADO_LOGO_Y = 22;
const ENCABEZADO_LOGO_ALTO = 30;
const ENCABEZADO_LINEA_Y = 62;
const CONTENIDO_Y_INICIO = 78;
const PIE_ALTO_RESERVADO = 46; // separación mínima entre el contenido y el pie

let promesaLibrerias = null;
let promesaLogo = null;

function cargarScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
        document.head.appendChild(script);
    });
}

function asegurarLibreriasPdf() {
    if (!promesaLibrerias) {
        promesaLibrerias = (async () => {
            if (!(window.jspdf && window.jspdf.jsPDF)) await cargarScript(CDN_JSPDF);
            if (!(window.jspdf && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable)) {
                await cargarScript(CDN_AUTOTABLE);
            }
        })();
    }
    return promesaLibrerias;
}

// El logo vive como .svg y jsPDF.addImage no acepta SVG directamente -- se
// dibuja una sola vez en un <canvas> y de ahí se saca el PNG que sí
// entiende jsPDF. Cacheado: el logo es el mismo en todos los PDFs de la
// sesión, no tiene sentido recargarlo en cada uno.
function cargarLogoPetcore() {
    if (!promesaLogo) {
        promesaLogo = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                // jsPDF NO reutiliza los bytes ya comprimidos del PNG -- lo
                // decodifica a píxeles crudos (RGBA) para incrustarlo, así
                // que el tamaño del PDF depende del ancho x alto del
                // CANVAS, no de cuánto pese el .svg de origen. El logo se
                // dibuja en el PDF a ~30pt de alto (0.42in); renderizarlo a
                // 150px de alto ya son ~360 DPI -- de sobra para verse
                // nítido -- en vez de los 401px nativos del .svg.
                const ALTURA_RENDER_PX = 150;
                const proporcion = img.naturalWidth / img.naturalHeight;
                const canvas = document.createElement('canvas');
                canvas.height = ALTURA_RENDER_PX;
                canvas.width = Math.round(ALTURA_RENDER_PX * proporcion);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve({ dataUrl: canvas.toDataURL('image/png'), proporcion });
            };
            img.onerror = () => reject(new Error('No se pudo cargar el logo de PetCore'));
            img.src = RUTA_LOGO;
        });
    }
    return promesaLogo;
}

function formatearFechaGeneracion() {
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const hora = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `Generado el ${fecha} · ${hora}`;
}

// Logo + título del documento a la izquierda, fecha de generación debajo, y
// una línea de marca separándolo del contenido -- se llama una vez por
// página física (ver asegurarMembretePagina).
function dibujarEncabezado(pdf, { titulo, logo, anchoPagina }) {
    const logoAncho = ENCABEZADO_LOGO_ALTO * logo.proporcion;
    // Alias fijo: sin esto, jsPDF incrusta una copia nueva del logo por
    // cada página en vez de reutilizar un único XObject.
    pdf.addImage(logo.dataUrl, 'PNG', MARGEN, ENCABEZADO_LOGO_Y, logoAncho, ENCABEZADO_LOGO_ALTO, 'logo-petcore-membrete');

    const textoX = MARGEN + logoAncho + 14;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(...COLOR_AZUL_OSCURO);
    pdf.text(titulo, textoX, ENCABEZADO_LOGO_Y + 13);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...COLOR_GRIS_META);
    pdf.text(formatearFechaGeneracion(), textoX, ENCABEZADO_LOGO_Y + 25);

    pdf.setDrawColor(...COLOR_AZUL_MEDIO);
    pdf.setLineWidth(0.75);
    pdf.line(MARGEN, ENCABEZADO_LINEA_Y, anchoPagina - MARGEN, ENCABEZADO_LINEA_Y);
}

// Línea sutil + "PetCore" a la izquierda -- el número de página se agrega
// después, en una pasada final (dibujarNumerosPagina), porque el total de
// páginas no se conoce hasta que TODO el documento ya se dibujó.
function dibujarPieBase(pdf, { anchoPagina, altoPagina }) {
    const lineaY = altoPagina - PIE_ALTO_RESERVADO + 10;
    const textoY = altoPagina - PIE_ALTO_RESERVADO + 24;

    pdf.setDrawColor(...COLOR_GRIS_LINEA);
    pdf.setLineWidth(0.5);
    pdf.line(MARGEN, lineaY, anchoPagina - MARGEN, lineaY);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLOR_GRIS_META);
    pdf.text('PetCore · Sistema de gestión veterinaria', MARGEN, textoY);
}

function dibujarNumerosPagina(pdf, { anchoPagina, altoPagina }) {
    const totalPaginas = pdf.internal.getNumberOfPages();
    const textoY = altoPagina - PIE_ALTO_RESERVADO + 24;
    for (let pagina = 1; pagina <= totalPaginas; pagina++) {
        pdf.setPage(pagina);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(...COLOR_GRIS_META);
        pdf.text(`Página ${pagina} de ${totalPaginas}`, anchoPagina - MARGEN, textoY, { align: 'right' });
    }
}

/* =====================================================================
   RECORRIDO DEL DOM -> BLOQUES DE CONTENIDO
   Traduce el elemento capturado en una lista de bloques simples
   ({tipo:'titulo'|'fila'|'texto'|'tabla'}) que dibujarBloques() ya sabe
   pintar con jsPDF. No es un motor de layout genérico para cualquier HTML
   -- está pensado para los patrones que de verdad usa el modal de
   "Detalle de factura": pares "etiqueta + valor" (d-flex justify-content-
   between) y las filas de ítems (.pc-factura-item).
   ===================================================================== */

const ETIQUETAS_INTERACTIVAS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A']);

function esVisible(elemento) {
    const estilo = getComputedStyle(elemento);
    return estilo.display !== 'none' && estilo.visibility !== 'hidden';
}

function esInteractivoODecorativo(elemento) {
    if (ETIQUETAS_INTERACTIVAS.has(elemento.tagName)) return true;
    if (elemento.hasAttribute('data-bs-toggle')) return true;
    if (elemento.classList.contains('dropdown')) return true;
    if (elemento.classList.contains('btn')) return true;
    return false;
}

function pareceNegrita(elemento) {
    if (/\bfw-bold\b|\bfw-semibold\b|font-weight-bold|_total_|-total-/i.test(elemento.className)) return true;
    const peso = getComputedStyle(elemento).fontWeight;
    return Number(peso) >= 600 || peso === 'bold';
}

// <table> -> {head, body}. Las columnas con encabezado vacío se descartan
// enteras (columnas de solo-iconos/acciones -- no tiene sentido imprimir
// una columna de botones).
function extraerTabla(tabla) {
    const filaHead = tabla.querySelector('thead tr');
    const celdasHead = filaHead ? Array.from(filaHead.children) : [];
    const columnasValidas = celdasHead.map(th => th.textContent.trim().length > 0);

    // Filas con colspan (típico de un <tfoot> de totales: "Subtotal" ocupando
    // 3 columnas + el valor en la última) no se pueden filtrar por índice de
    // columna como las filas normales -- se mandan con su colSpan real para
    // que AutoTable las alinee bien, en vez de perder la fila entera o
    // desalinear el valor contra la columna equivocada.
    const filtrarFila = (celdas) => {
        const tieneColspan = celdas.some(celda => celda.colSpan > 1);
        if (tieneColspan) {
            return celdas.map(celda => (
                celda.colSpan > 1
                    ? { content: celda.textContent.trim(), colSpan: celda.colSpan, styles: { halign: 'right' } }
                    : celda.textContent.trim()
            ));
        }
        return celdas
            .filter((_, i) => columnasValidas.length === 0 || columnasValidas[i])
            .map(celda => celda.textContent.trim());
    };

    const head = celdasHead.length ? [filtrarFila(celdasHead)] : undefined;
    const body = Array.from(tabla.querySelectorAll('tbody tr'))
        .map(fila => filtrarFila(Array.from(fila.children)))
        .filter(fila => fila.some(texto => (typeof texto === 'string' ? texto : texto.content).length > 0));
    const filasFoot = Array.from(tabla.querySelectorAll('tfoot tr'))
        .map(fila => filtrarFila(Array.from(fila.children)))
        .filter(fila => fila.some(texto => (typeof texto === 'string' ? texto : texto.content).length > 0));

    return { head, body, foot: filasFoot.length ? filasFoot : undefined };
}

function extraerBloques(raiz, elementosExcluidos) {
    const bloques = [];

    function procesar(elemento) {
        if (elementosExcluidos.has(elemento)) return;
        if (!esVisible(elemento)) return;

        if (elemento.tagName === 'TABLE') {
            const { head, body, foot } = extraerTabla(elemento);
            if (body.length) bloques.push({ tipo: 'tabla', head, body, foot });
            return;
        }

        if (/^H[1-6]$/.test(elemento.tagName)) {
            const texto = elemento.textContent.trim();
            if (texto) bloques.push({ tipo: 'titulo', texto });
            return;
        }

        if (esInteractivoODecorativo(elemento)) return;

        const hijos = Array.from(elemento.children)
            .filter(esVisible)
            .filter(hijo => !elementosExcluidos.has(hijo));

        if (hijos.length === 0) {
            const texto = elemento.textContent.trim();
            if (texto) bloques.push({ tipo: 'texto', texto, negrita: pareceNegrita(elemento) });
            return;
        }

        // Tarjeta compacta tipo "etiqueta + valor" (o "etiqueta + valor +
        // nota"): todos sus hijos son hojas (sin sub-hijos visibles propios)
        // -- se imprime como una sola línea en vez de recursar y repetir
        // fragmentos de texto sueltos.
        const todosSonHojas = hijos.every(hijo =>
            Array.from(hijo.children).filter(esVisible).length === 0 && !esInteractivoODecorativo(hijo)
        );
        if (todosSonHojas && hijos.length <= 4) {
            const partes = hijos.map(hijo => hijo.textContent.trim()).filter(Boolean);
            if (partes.length) {
                bloques.push({ tipo: 'fila', partes, negrita: pareceNegrita(elemento) || hijos.some(pareceNegrita) });
                return;
            }
        }

        hijos.forEach(procesar);
    }

    procesar(raiz);
    return bloques;
}

/* =====================================================================
   DIBUJO DE BLOQUES
   ===================================================================== */

function crearContexto(pdf) {
    return {
        anchoPagina: pdf.internal.pageSize.getWidth(),
        altoPagina: pdf.internal.pageSize.getHeight(),
        anchoContenido: pdf.internal.pageSize.getWidth() - MARGEN * 2
    };
}

function dibujarBloques(pdf, bloques, { titulo, logo }) {
    const ctx = crearContexto(pdf);
    const paginasConMembrete = new Set();
    let cursorY = CONTENIDO_Y_INICIO;

    function asegurarMembretePagina() {
        const numeroPagina = pdf.internal.getCurrentPageInfo().pageNumber;
        if (paginasConMembrete.has(numeroPagina)) return;
        paginasConMembrete.add(numeroPagina);
        dibujarEncabezado(pdf, { titulo, logo, anchoPagina: ctx.anchoPagina });
        dibujarPieBase(pdf, ctx);
    }

    function saltarPaginaSiNecesario(alturaLinea) {
        if (cursorY + alturaLinea > ctx.altoPagina - PIE_ALTO_RESERVADO) {
            pdf.addPage();
            cursorY = CONTENIDO_Y_INICIO;
            asegurarMembretePagina();
        }
    }

    function escribirLineas(lineas, { tamano, negrita, color, alturaLinea = tamano + 3.5 }) {
        pdf.setFont('helvetica', negrita ? 'bold' : 'normal');
        pdf.setFontSize(tamano);
        pdf.setTextColor(...color);
        lineas.forEach(linea => {
            saltarPaginaSiNecesario(alturaLinea);
            pdf.text(linea, MARGEN, cursorY);
            cursorY += alturaLinea;
        });
    }

    asegurarMembretePagina();

    bloques.forEach(bloque => {
        if (bloque.tipo === 'titulo') {
            cursorY += 4;
            const lineas = pdf.splitTextToSize(bloque.texto, ctx.anchoContenido);
            escribirLineas(lineas, { tamano: 11.5, negrita: true, color: COLOR_AZUL_OSCURO });
            cursorY += 3;
            return;
        }

        if (bloque.tipo === 'fila') {
            saltarPaginaSiNecesario(13);
            if (bloque.partes.length === 2) {
                // Patrón "etiqueta ............ valor" -- el más común (totales,
                // datos de cabecera) -- en una sola línea, valor a la derecha.
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9);
                pdf.setTextColor(...COLOR_GRIS_META);
                pdf.text(bloque.partes[0], MARGEN, cursorY);

                pdf.setFont('helvetica', bloque.negrita ? 'bold' : 'normal');
                pdf.setTextColor(...(bloque.negrita ? COLOR_AZUL_OSCURO : COLOR_TEXTO));
                pdf.text(bloque.partes[1], ctx.anchoPagina - MARGEN, cursorY, { align: 'right' });
                cursorY += 14;
            } else {
                // 3+ fragmentos (etiqueta + valor + nota aparte): la etiqueta
                // como "eyebrow" chico y el resto en la línea de abajo.
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(7.5);
                pdf.setTextColor(...COLOR_GRIS_META);
                pdf.text(bloque.partes[0].toUpperCase(), MARGEN, cursorY);
                cursorY += 11;

                saltarPaginaSiNecesario(13);
                pdf.setFont('helvetica', bloque.negrita ? 'bold' : 'normal');
                pdf.setFontSize(9.5);
                pdf.setTextColor(...COLOR_TEXTO);
                pdf.text(bloque.partes.slice(1).join('   ·   '), MARGEN, cursorY);
                cursorY += 15;
            }
            return;
        }

        if (bloque.tipo === 'texto') {
            const lineas = pdf.splitTextToSize(bloque.texto, ctx.anchoContenido);
            escribirLineas(lineas, { tamano: 9, negrita: bloque.negrita, color: COLOR_TEXTO });
            cursorY += 4;
            return;
        }

        if (bloque.tipo === 'tabla') {
            pdf.autoTable({
                head: bloque.head,
                body: bloque.body,
                foot: bloque.foot,
                showFoot: 'lastPage',
                startY: cursorY,
                margin: { left: MARGEN, right: MARGEN, top: CONTENIDO_Y_INICIO, bottom: PIE_ALTO_RESERVADO },
                styles: { fontSize: 8.5, cellPadding: 5, textColor: COLOR_TEXTO, lineColor: COLOR_GRIS_LINEA, lineWidth: 0.5 },
                headStyles: { fillColor: COLOR_AZUL_MEDIO, textColor: 255, fontStyle: 'bold' },
                // Última fila del pie (el Total) más marcada que el resto --
                // AutoTable no distingue "la última fila del foot" por sí
                // solo, así que se resalta a mano después de dibujar.
                footStyles: { fillColor: [247, 249, 251], textColor: COLOR_TEXTO, fontStyle: 'bold', lineWidth: { top: 0.75 } },
                alternateRowStyles: { fillColor: [247, 249, 251] },
                didDrawPage: asegurarMembretePagina,
                didParseCell: function (data) {
                    if (data.section === 'foot' && bloque.foot && data.row.index === bloque.foot.length - 1) {
                        data.cell.styles.textColor = COLOR_AZUL_OSCURO;
                        data.cell.styles.fontSize = 10;
                    }
                }
            });
            cursorY = pdf.lastAutoTable.finalY + 16;
            return;
        }
    });

    dibujarNumerosPagina(pdf, ctx);
}

/**
 * Genera y GUARDA un PDF a partir de un elemento del DOM ya renderizado, dibujando su contenido (tablas, títulos,
 * pares etiqueta/valor) como texto y tablas vectoriales de verdad, con membrete formal y pie paginado.
 *
 * @param {HTMLElement|string} elementoOSelector - elemento o selector CSS del contenido a exportar.
 * @param {Object} [opciones]
 * @param {string} [opciones.nombreArchivo] - nombre del archivo descargado.
 * @param {string} [opciones.titulo] - título del documento, mostrado junto al logo en el membrete.
 * @param {string[]} [opciones.ocultarSelectores] - selectores (buscados dentro del elemento) que se
 *        excluyen del documento -- botones, menús de "más opciones", etc.
 * @returns {Promise<{nativo: boolean, ubicacion: string}>} dónde quedó el archivo (para avisárselo al usuario).
 */
export async function generarPdfDesdeElemento(elementoOSelector, opciones = {}) {
    const elemento = typeof elementoOSelector === 'string'
        ? document.querySelector(elementoOSelector)
        : elementoOSelector;

    if (!elemento) {
        throw new Error('generarPdfDesdeElemento: no se encontró el elemento a exportar');
    }

    const { nombreArchivo = 'documento.pdf', titulo = 'Documento PetCore', ocultarSelectores = [], accion = 'descargar' } = opciones;

    const elementosExcluidos = new Set(
        ocultarSelectores.flatMap(selector => Array.from(elemento.querySelectorAll(selector)))
    );

    return generarPdfDesdeBloques(extraerBloques(elemento, elementosExcluidos), { nombreArchivo, titulo, accion });
}

/* Dibuja los bloques en un PDF y lo guarda. Común a los PDFs hechos desde el DOM (facturas) y a los armados con datos
   (cartilla digital). */
async function generarPdfDesdeBloques(bloques, { nombreArchivo, titulo, accion = 'descargar' }) {
    const [, logo] = await Promise.all([asegurarLibreriasPdf(), cargarLogoPetcore()]);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    dibujarBloques(pdf, bloques, { titulo, logo });

    // "ver": se abre dentro de la app (visor propio, ver visor_pdf.js). "compartir": hoja de compartir del sistema.
    // "descargar" (por defecto): lo de siempre, abajo.
    if (accion === 'ver') {
        const { abrirVisorPdf } = await import('./visor_pdf.js');
        await abrirVisorPdf(pdf.output('arraybuffer'), {
            titulo,
            onCompartir: () => compartirPdf(pdf, nombreArchivo, titulo).catch((e) => console.error('[PDF] No se pudo compartir:', e)),
            onDescargar: () => guardarPdf(pdf, nombreArchivo).then((r) => avisarDescarga(r)).catch((e) => console.error('[PDF] No se pudo descargar:', e))
        });
        return { accion: 'ver' };
    }
    if (accion === 'compartir') {
        await compartirPdf(pdf, nombreArchivo, titulo);
        return { accion: 'compartir' };
    }
    return { accion: 'descargar', ...(await guardarPdf(pdf, nombreArchivo)) };
}

// Desde el visor la descarga no pasa por el controller: se avisa aquí dónde quedó (solo en la app el archivo no es evidente).
function avisarDescarga(resultado) {
    if (resultado && resultado.nativo && window.Swal) {
        window.Swal.fire({ icon: 'success', title: 'PDF descargado', text: 'Se guardó en ' + resultado.ubicacion + '.', confirmButtonColor: '#2D60A1' });
    }
}

async function guardarPdf(pdf, nombreArchivo) {
    // pdf.save() descarga con un <a download> sintético -- funciona en cualquier navegador real, pero los WebView
    // nativos (Android/iOS, Capacitor) lo ignoran en silencio. Ahí se escribe el archivo a disco con el plugin
    // Filesystem (carpeta Documentos): queda guardado de verdad, sin abrir la hoja de compartir.
    if (window.Capacitor?.isNativePlatform?.()) {
        return guardarPdfNativo(pdf, nombreArchivo);
    }

    pdf.save(nombreArchivo);
    return { nativo: false, ubicacion: 'la carpeta de descargas de tu navegador' };
}

/* Compartir el PDF con el menú del sistema (WhatsApp, correo, Drive...).
   - App nativa: se escribe en la carpeta de caché (se limpia sola, no ensucia Documentos) y se comparte esa ruta con
     @capacitor/share (la caché ya está autorizada en file_paths.xml del FileProvider).
   - Navegador: Web Share con archivo si el navegador lo soporta; si no, se descarga. */
async function compartirPdf(pdf, nombreArchivo, titulo) {
    if (window.Capacitor?.isNativePlatform?.()) {
        const Filesystem = window.Capacitor?.Plugins?.Filesystem || window.Capacitor?.registerPlugin?.('Filesystem');
        const Share = window.Capacitor?.Plugins?.Share || window.Capacitor?.registerPlugin?.('Share');
        if (!Filesystem || !Share) throw new Error('compartirPdf: plugins Filesystem/Share no disponibles');

        const dataUri = pdf.output('datauristring');
        const base64 = dataUri.slice(dataUri.indexOf('base64,') + 'base64,'.length);
        await Filesystem.writeFile({ path: nombreArchivo, data: base64, directory: 'CACHE', recursive: true });
        const { uri } = await Filesystem.getUri({ path: nombreArchivo, directory: 'CACHE' });
        try {
            await Share.share({ title: titulo, text: titulo, url: uri, dialogTitle: 'Compartir PDF' });
        } catch (error) {
            // Cerrar la hoja sin elegir nada no es un error
            if (!/cancel/i.test(String(error?.message || error))) throw error;
        }
        return;
    }

    const archivo = new File([pdf.output('blob')], nombreArchivo, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        try {
            await navigator.share({ files: [archivo], title: titulo });
        } catch (error) {
            if (error?.name !== 'AbortError') throw error;
        }
        return;
    }
    pdf.save(nombreArchivo);   // sin Web Share: al menos que lo pueda guardar
}

async function guardarPdfNativo(pdf, nombreArchivo) {
    const Filesystem = window.Capacitor?.Plugins?.Filesystem || window.Capacitor?.registerPlugin?.('Filesystem');
    if (!Filesystem) {
        throw new Error('generarPdf: plugin Filesystem no disponible');
    }
    const plataforma = window.Capacitor?.getPlatform?.();

    // "data:application/pdf;filename=...;base64,XXXX" -- Filesystem.writeFile solo quiere el base64 puro.
    const dataUri = pdf.output('datauristring');
    const base64 = dataUri.slice(dataUri.indexOf('base64,') + 'base64,'.length);

    // Android 10+ (almacenamiento por ámbitos): escribir con ruta directa en Documentos falla con "EACCES (Permission
    // denied)" (visto en un Galaxy S25 Ultra). Se guarda con el plugin nativo propio (GuardarArchivoPlugin.java), que
    // usa MediaStore y deja el PDF en Descargas/PetCore sin pedir permisos. Si no está disponible o es Android 9 o
    // anterior, se sigue con Filesystem como antes.
    if (plataforma === 'android') {
        const GuardarArchivo = window.Capacitor?.Plugins?.GuardarArchivo || window.Capacitor?.registerPlugin?.('GuardarArchivo');
        if (GuardarArchivo?.guardarEnDescargas) {
            try {
                await GuardarArchivo.guardarEnDescargas({ nombre: nombreArchivo, datos: base64, tipo: 'application/pdf' });
                return { nativo: true, ubicacion: 'la carpeta Descargas > PetCore de tu teléfono' };
            } catch (error) {
                // "SDK_ANTIGUO" es el caso normal de Android 9 o anterior; cualquier otro error se registra y se reintenta abajo
                if (!/SDK_ANTIGUO/.test(String(error?.message || error))) {
                    console.warn('[PDF] Guardado en Descargas falló, se reintenta con Filesystem:', error);
                }
            }
        }
    }

    // Android antiguo (≤ 9) pide permiso de almacenamiento para escribir en carpetas públicas; en versiones nuevas
    // la llamada no pide nada. Si el usuario lo niega, el writeFile de abajo falla y se avisa.
    if (plataforma === 'android' && Filesystem.requestPermissions) {
        try { await Filesystem.requestPermissions(); } catch (e) { /* se intenta escribir igual */ }
    }

    await Filesystem.writeFile({
        path: nombreArchivo,
        data: base64,
        directory: 'DOCUMENTS',
        recursive: true
    });

    return {
        nativo: true,
        ubicacion: plataforma === 'ios'
            ? 'la app Archivos, en "En mi iPhone" > PetCore'
            : 'la carpeta Documentos de tu teléfono'
    };
}

/* =====================================================================
   CARTILLA DIGITAL DE UNA MASCOTA
   ===================================================================== */

function fechaCorta(valor) {
    if (!valor) return '—';
    const iso = String(valor).slice(0, 10);
    const [a, m, d] = iso.split('-');
    return (a && m && d) ? `${d}/${m}/${a}` : '—';
}

/**
 * Genera y guarda la cartilla digital (datos de la mascota, vacunas y antiparasitarios) como PDF.
 * @param {{mascota: Object, propietario: string, vacunas: Object[], antiparasitarios: Object[]}} datos
 * @returns {Promise<{nativo: boolean, ubicacion: string}>}
 */
export async function generarPdfCartilla({ mascota, propietario, vacunas = [], antiparasitarios = [], accion = 'descargar' }) {
    const bloques = [];

    bloques.push({ tipo: 'titulo', texto: 'Datos de la mascota' });
    [
        ['Nombre', mascota.mas_nombre || '—'],
        ['Especie', mascota.nombreEspecie || '—'],
        ['Raza', mascota.nombreRaza || '—'],
        ['Sexo', mascota.mas_genero || '—'],
        ['Fecha de nacimiento', fechaCorta(mascota.mas_fecha_nac)],
        ['Peso', mascota.mas_peso_kg != null ? `${mascota.mas_peso_kg} kg` : 'No registrado'],
        ['Propietario', propietario || '—']
    ].forEach(par => bloques.push({ tipo: 'fila', partes: par, negrita: false }));

    bloques.push({ tipo: 'titulo', texto: 'Vacunas' });
    if (vacunas.length) {
        bloques.push({
            tipo: 'tabla',
            head: [['Vacuna', 'Fecha', 'Lote', 'Próxima dosis', 'Estado']],
            body: vacunas.map(v => [
                v.nombreProducto || v.car_nombre_externo || 'Vacuna',
                fechaCorta(v.car_fecha_vacunacion),
                v.car_lote_aplicado || '—',
                fechaCorta(v.car_proxima_cita_recomendada),
                v.car_estado || '—'
            ])
        });
    } else {
        bloques.push({ tipo: 'texto', texto: 'Aún no hay vacunas registradas en la cartilla.', negrita: false });
    }

    bloques.push({ tipo: 'titulo', texto: 'Antiparasitarios' });
    if (antiparasitarios.length) {
        bloques.push({
            tipo: 'tabla',
            head: [['Producto', 'Tipo', 'Aplicación', 'Próxima aplicación', 'Estado']],
            body: antiparasitarios.map(a => [
                a.nombreProducto || a.ap_nombre_externo || 'Antiparasitario',
                a.ap_tipo || '—',
                fechaCorta(a.ap_fecha_aplicacion),
                fechaCorta(a.ap_fecha_prox_aplicacion),
                a.ap_estado || '—'
            ])
        });
    } else {
        bloques.push({ tipo: 'texto', texto: 'Aún no hay antiparasitarios registrados.', negrita: false });
    }

    const nombreLimpio = String(mascota.mas_nombre || 'mascota').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');
    return generarPdfDesdeBloques(bloques, {
        titulo: `Cartilla digital · ${mascota.mas_nombre || 'Mascota'}`,
        nombreArchivo: `cartilla_${nombreLimpio}.pdf`,
        accion
    });
}
