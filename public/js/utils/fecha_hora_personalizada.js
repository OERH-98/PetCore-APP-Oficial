/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/fecha_hora_personalizada.js
   Reemplaza visualmente un <input type="date">/<input type="time"> nativo
   por un selector propio -- el calendario/reloj que dibuja el navegador es
   el del propio sistema operativo, sin forma de darle el mismo look que
   el resto del portal ni en claro ni en oscuro. Mismo patrón que
   selector_personalizado.js: el <input> original NO se elimina -- se
   oculta pero sigue siendo la fuente de verdad (mismo id, mismo .value en
   formato ISO/HH:mm, mismos eventos "change"). El sustituto es un
   <button>, no un <input>, por la misma razón que el select personalizado:
   un input (aunque sea readonly) puede levantar el teclado virtual en
   ciertas combinaciones de Android/iOS; un botón nunca.
   ========================================================================== */

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
  "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

function pad2(n) { return String(n).padStart(2, "0"); }

function fechaDesdeISO(iso) {
  if (!iso) return null;
  const [anio, mes, dia] = iso.split("-").map(Number);
  if (!anio || !mes || !dia) return null;
  return new Date(anio, mes - 1, dia);
}
function fechaAISO(fecha) {
  return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}-${pad2(fecha.getDate())}`;
}
function formatearFechaVisible(iso) {
  const fecha = fechaDesdeISO(iso);
  if (!fecha) return "";
  return `${pad2(fecha.getDate())}/${pad2(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
}
function mismoDia(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function construirBase(input, opciones, tipoIcono) {
  if (!input || input.dataset.fechaHoraPersonalizadaLista === "1") return null;
  input.dataset.fechaHoraPersonalizadaLista = "1";

  const clasesOriginales = input.className;
  const ariaLabel = input.getAttribute("aria-label") || "";
  const idOriginal = input.id;

  input.classList.add("pc-fecha-hora-oculta", "d-none");
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;

  const boton = document.createElement("button");
  boton.type = "button";
  if (idOriginal) boton.id = `${idOriginal}_VISUAL`;
  boton.className = `${clasesOriginales} pc-fecha-hora-input pc-fecha-hora-input--${tipoIcono}`;
  if (ariaLabel) boton.setAttribute("aria-label", ariaLabel);
  boton.setAttribute("role", "combobox");
  boton.setAttribute("aria-expanded", "false");
  boton.setAttribute("aria-haspopup", "dialog");

  input.insertAdjacentElement("afterend", boton);

  if (idOriginal && boton.id) {
    const etiqueta = document.querySelector(`label[for="${idOriginal}"]`);
    if (etiqueta) etiqueta.setAttribute("for", boton.id);
  }

  const popup = document.createElement("div");
  popup.className = "pc-fecha-hora-popup";
  popup.setAttribute("role", "dialog");
  document.body.appendChild(popup);

  function posicionar() {
    const rect = boton.getBoundingClientRect();
    const margen = 4;
    const anchoPopup = popup.offsetWidth || 280;
    const altoPopup = popup.offsetHeight || 320;
    const espacioAbajo = window.innerHeight - rect.bottom - margen - 8;
    const espacioArriba = rect.top - margen - 8;

    let izquierda = rect.left;
    if (izquierda + anchoPopup > window.innerWidth - 8) {
      izquierda = Math.max(8, window.innerWidth - anchoPopup - 8);
    }
    popup.style.left = `${izquierda}px`;

    if (espacioAbajo >= altoPopup || espacioAbajo >= espacioArriba) {
      popup.style.top = `${rect.bottom + margen}px`;
      popup.style.bottom = "auto";
      popup.style.maxHeight = `${Math.max(200, espacioAbajo)}px`;
    } else {
      popup.style.top = "auto";
      popup.style.bottom = `${window.innerHeight - rect.top + margen}px`;
      popup.style.maxHeight = `${Math.max(200, espacioArriba)}px`;
    }
  }

  function abrir(renderizar) {
    if (boton.disabled) return;
    renderizar();
    popup.classList.add("show");
    posicionar();
    requestAnimationFrame(posicionar);
    boton.setAttribute("aria-expanded", "true");
  }

  function cerrar() {
    popup.classList.remove("show");
    boton.setAttribute("aria-expanded", "false");
  }

  function estaAbierto() {
    return popup.classList.contains("show");
  }

  popup.addEventListener("mousedown", evento => evento.preventDefault());

  boton.addEventListener("blur", () => {
    setTimeout(() => {
      if (!popup.contains(document.activeElement)) cerrar();
    }, 120);
  });

  document.addEventListener("keydown", evento => {
    if (evento.key === "Escape" && estaAbierto()) cerrar();
  });

  window.addEventListener("scroll", evento => {
    if (!estaAbierto()) return;
    if (evento.target === popup || popup.contains(evento.target)) return;
    cerrar();
  }, true);
  window.addEventListener("resize", () => { if (estaAbierto()) posicionar(); });

  boton.disabled = input.disabled;

  return { boton, popup, abrir, cerrar, estaAbierto, posicionar };
}

/* =====================================================================
   SELECTOR DE FECHA (calendario)
   ===================================================================== */
export function crearFechaPersonalizada(input, opciones = {}) {
  const base = construirBase(input, opciones, "fecha");
  if (!base) return null;
  const { boton, popup, abrir, cerrar } = base;

  let mesVisible = new Date();
  // "dias" -> "meses" (12 meses del año, al tocar el nombre del mes) ->
  // "anios" (bloque de 12 años, al tocar el año) -- mismo mecanismo que
  // cualquier date picker nativo, para no tener que darle a "siguiente"
  // decenas de veces si la fecha está lejos.
  let vista = "dias";

  function limites() {
    return {
      min: input.min ? fechaDesdeISO(input.min) : null,
      max: input.max ? fechaDesdeISO(input.max) : null
    };
  }

  // opciones.estaDeshabilitada(fechaISO) es opcional -- recibe "yyyy-MM-dd"
  // y devuelve true si ese día puntual no se puede elegir (ej. un día
  // feriado), independiente del rango min/max. Se consulta tanto al dibujar
  // la grilla como dentro de elegir(), porque el botón "Hoy" del pie del
  // calendario llama a elegir() directo sin pasar por un botón disabled de
  // la grilla.
  function estaDeshabilitada(fecha) {
    const { min, max } = limites();
    if ((min && fecha < min) || (max && fecha > max)) return true;
    return typeof opciones.estaDeshabilitada === "function" && !!opciones.estaDeshabilitada(fechaAISO(fecha));
  }

  function actualizarVisible() {
    const texto = formatearFechaVisible(input.value);
    boton.textContent = texto || (opciones.placeholder || "dd/mm/aaaa");
    boton.classList.toggle("pc-fecha-hora-input--vacio", !texto);
  }

  function elegir(fecha) {
    if (estaDeshabilitada(fecha)) return;
    input.value = fechaAISO(fecha);
    actualizarVisible();
    cerrar();
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function renderizar() {
    if (vista === "meses") renderizarMeses();
    else if (vista === "anios") renderizarAnios();
    else renderizarDias();
  }

  function renderizarDias() {
    const hoy = new Date();
    const actual = fechaDesdeISO(input.value);
    const anio = mesVisible.getFullYear();
    const mes = mesVisible.getMonth();

    const primerDiaSemana = (new Date(anio, mes, 1).getDay() + 6) % 7;
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    const diasMesAnterior = new Date(anio, mes, 0).getDate();

    let celdas = "";
    for (let i = primerDiaSemana - 1; i >= 0; i--) {
      celdas += `<span class="pc-fecha-hora-dia pc-fecha-hora-dia--ajena">${diasMesAnterior - i}</span>`;
    }
    for (let dia = 1; dia <= diasEnMes; dia++) {
      const fechaCelda = new Date(anio, mes, dia);
      const deshabilitado = estaDeshabilitada(fechaCelda);
      // Marcado aparte de "deshabilitado" a secas -- opciones.estaDeshabilitada
      // (ej. día feriado) tiene un motivo puntual que vale la pena distinguir
      // visualmente de un día fuera de rango (min/max) sin más explicación.
      const marcada = typeof opciones.estaDeshabilitada === "function" && !!opciones.estaDeshabilitada(fechaAISO(fechaCelda));
      const clases = ["pc-fecha-hora-dia"];
      if (mismoDia(fechaCelda, hoy)) clases.push("pc-fecha-hora-dia--hoy");
      if (mismoDia(fechaCelda, actual)) clases.push("pc-fecha-hora-dia--activo");
      if (marcada) clases.push("pc-fecha-hora-dia--feriado");
      if (deshabilitado) clases.push("pc-fecha-hora-dia--deshabilitado");
      const titulo = marcada ? ' title="Día feriado"' : "";
      celdas += `<button type="button" class="${clases.join(" ")}" ${deshabilitado ? "disabled" : ""} data-dia="${dia}"${titulo}>${dia}</button>`;
    }
    const totalCeldas = primerDiaSemana + diasEnMes;
    const restantes = (7 - (totalCeldas % 7)) % 7;
    for (let dia = 1; dia <= restantes; dia++) {
      celdas += `<span class="pc-fecha-hora-dia pc-fecha-hora-dia--ajena">${dia}</span>`;
    }

    popup.innerHTML = `
      <div class="pc-fecha-hora-cabecera">
        <button type="button" class="pc-fecha-hora-nav" data-accion="anterior" aria-label="Mes anterior">&#8249;</button>
        <span class="pc-fecha-hora-titulo">
          <button type="button" class="pc-fecha-hora-titulo-parte" data-vista="meses">${MESES[mes]}</button>
          <button type="button" class="pc-fecha-hora-titulo-parte" data-vista="anios">${anio}</button>
        </span>
        <button type="button" class="pc-fecha-hora-nav" data-accion="siguiente" aria-label="Mes siguiente">&#8250;</button>
      </div>
      <div class="pc-fecha-hora-semana">${DIAS_SEMANA.map(d => `<span>${d}</span>`).join("")}</div>
      <div class="pc-fecha-hora-grilla">${celdas}</div>
      <div class="pc-fecha-hora-pie">
        <button type="button" class="pc-fecha-hora-btn-pie" data-accion="hoy">Hoy</button>
        <button type="button" class="pc-fecha-hora-btn-pie" data-accion="limpiar">Limpiar</button>
      </div>`;
  }

  function renderizarMeses() {
    const anio = mesVisible.getFullYear();
    const mesActual = mesVisible.getMonth();
    const botones = MESES.map((nombre, indice) =>
      `<button type="button" class="pc-fecha-hora-mes${indice === mesActual ? " pc-fecha-hora-mes--activo" : ""}" data-mes="${indice}">${nombre.slice(0, 3)}</button>`
    ).join("");

    popup.innerHTML = `
      <div class="pc-fecha-hora-cabecera">
        <button type="button" class="pc-fecha-hora-nav" data-accion="anio-anterior" aria-label="Año anterior">&#8249;</button>
        <span class="pc-fecha-hora-titulo">
          <button type="button" class="pc-fecha-hora-titulo-parte" data-vista="anios">${anio}</button>
        </span>
        <button type="button" class="pc-fecha-hora-nav" data-accion="anio-siguiente" aria-label="Año siguiente">&#8250;</button>
      </div>
      <div class="pc-fecha-hora-grilla-meses">${botones}</div>`;
  }

  function renderizarAnios() {
    const base2 = Math.floor(mesVisible.getFullYear() / 12) * 12;
    const anioActual = mesVisible.getFullYear();
    let botones = "";
    for (let i = 0; i < 12; i++) {
      const anio = base2 + i;
      botones += `<button type="button" class="pc-fecha-hora-anio${anio === anioActual ? " pc-fecha-hora-anio--activo" : ""}" data-anio="${anio}">${anio}</button>`;
    }

    popup.innerHTML = `
      <div class="pc-fecha-hora-cabecera">
        <button type="button" class="pc-fecha-hora-nav" data-accion="decada-anterior" aria-label="12 años antes">&#8249;</button>
        <span class="pc-fecha-hora-titulo">${base2} - ${base2 + 11}</span>
        <button type="button" class="pc-fecha-hora-nav" data-accion="decada-siguiente" aria-label="12 años después">&#8250;</button>
      </div>
      <div class="pc-fecha-hora-grilla-anios">${botones}</div>`;
  }

  popup.addEventListener("click", evento => {
    const boton2 = evento.target.closest("button");
    if (!boton2) return;

    if (boton2.dataset.dia) {
      elegir(new Date(mesVisible.getFullYear(), mesVisible.getMonth(), Number(boton2.dataset.dia)));
      return;
    }
    if (boton2.dataset.mes !== undefined) {
      mesVisible = new Date(mesVisible.getFullYear(), Number(boton2.dataset.mes), 1);
      vista = "dias";
      renderizar();
      base.posicionar();
      return;
    }
    if (boton2.dataset.anio !== undefined) {
      mesVisible = new Date(Number(boton2.dataset.anio), mesVisible.getMonth(), 1);
      vista = "meses";
      renderizar();
      base.posicionar();
      return;
    }
    if (boton2.dataset.vista) {
      vista = boton2.dataset.vista;
      renderizar();
      base.posicionar();
      return;
    }

    switch (boton2.dataset.accion) {
      case "anterior":
        mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() - 1, 1);
        renderizar();
        base.posicionar();
        break;
      case "siguiente":
        mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 1);
        renderizar();
        base.posicionar();
        break;
      case "anio-anterior":
        mesVisible = new Date(mesVisible.getFullYear() - 1, mesVisible.getMonth(), 1);
        renderizar();
        base.posicionar();
        break;
      case "anio-siguiente":
        mesVisible = new Date(mesVisible.getFullYear() + 1, mesVisible.getMonth(), 1);
        renderizar();
        base.posicionar();
        break;
      case "decada-anterior":
        mesVisible = new Date(mesVisible.getFullYear() - 12, mesVisible.getMonth(), 1);
        renderizar();
        base.posicionar();
        break;
      case "decada-siguiente":
        mesVisible = new Date(mesVisible.getFullYear() + 12, mesVisible.getMonth(), 1);
        renderizar();
        base.posicionar();
        break;
      case "hoy":
        elegir(new Date());
        break;
      case "limpiar":
        input.value = "";
        actualizarVisible();
        cerrar();
        input.dispatchEvent(new Event("change", { bubbles: true }));
        break;
    }
  });

  function abrirEnVistaDias() {
    mesVisible = fechaDesdeISO(input.value) || new Date();
    vista = "dias";
    abrir(renderizar);
  }

  boton.addEventListener("click", abrirEnVistaDias);
  boton.addEventListener("keydown", evento => {
    if (evento.key === "Enter" || evento.key === " " || evento.key === "ArrowDown") {
      evento.preventDefault();
      abrirEnVistaDias();
    }
  });

  actualizarVisible();

  return {
    refrescar() {
      actualizarVisible();
      boton.disabled = input.disabled;
    }
  };
}

/* =====================================================================
   SELECTOR DE HORA (columnas de horas / minutos)
   ===================================================================== */
export function crearHoraPersonalizada(input, opciones = {}) {
  const base = construirBase(input, opciones, "hora");
  if (!base) return null;
  const { boton, popup, abrir, cerrar } = base;

  const pasoMinutos = Math.max(1, Math.round((Number(input.step) || 60) / 60)) || 1;

  let horaPend = null;
  let minPend = null;

  function actualizarVisible() {
    const texto = input.value || "";
    boton.textContent = texto || (opciones.placeholder || "hh:mm");
    boton.classList.toggle("pc-fecha-hora-input--vacio", !texto);
  }

  function horaActual() {
    const [h, m] = (input.value || "").split(":").map(Number);
    return { h: Number.isFinite(h) ? h : null, m: Number.isFinite(m) ? m : null };
  }

  function confirmarSiCompleto() {
    if (horaPend === null || minPend === null) return;
    input.value = `${pad2(horaPend)}:${pad2(minPend)}`;
    actualizarVisible();
    cerrar();
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // opciones.estaDeshabilitada(horaStr) es opcional -- recibe "HH:MM" y
  // devuelve true si ese horario exacto ya está ocupado. Se llama en cada
  // apertura del popup (nunca queda en caché), así que si el propietario
  // cambió la fecha entre una apertura y otra, la próxima vez que abra el
  // selector de hora ya refleja los horarios ocupados de la fecha nueva.
  function estaOcupada(horaStr) {
    return typeof opciones.estaDeshabilitada === "function" && !!opciones.estaDeshabilitada(horaStr);
  }

  function horaCompletamenteOcupada(h) {
    if (typeof opciones.estaDeshabilitada !== "function") return false;
    for (let m = 0; m < 60; m += pasoMinutos) {
      if (!estaOcupada(`${pad2(h)}:${pad2(m)}`)) return false;
    }
    return true;
  }

  function generarBotonesMinutos(horaSel, minutoActivo) {
    let html = "";
    for (let m = 0; m < 60; m += pasoMinutos) {
      const ocupado = horaSel !== null && estaOcupada(`${pad2(horaSel)}:${pad2(m)}`);
      html += `<button type="button" class="pc-fecha-hora-item${m === minutoActivo ? " pc-fecha-hora-item--activo" : ""}${ocupado ? " pc-fecha-hora-item--deshabilitado" : ""}" data-minuto="${m}"${ocupado ? " disabled" : ""}>${pad2(m)}</button>`;
    }
    return html;
  }

  function renderizarColumnas() {
    const actual = horaActual();
    horaPend = actual.h;
    minPend = actual.m;

    let horas = "";
    for (let h = 0; h < 24; h++) {
      const ocupada = horaCompletamenteOcupada(h);
      horas += `<button type="button" class="pc-fecha-hora-item${h === actual.h ? " pc-fecha-hora-item--activo" : ""}${ocupada ? " pc-fecha-hora-item--deshabilitado" : ""}" data-hora="${h}"${ocupada ? " disabled" : ""}>${pad2(h)}</button>`;
    }
    const minutos = generarBotonesMinutos(actual.h, actual.m);

    popup.innerHTML = `
      <div class="pc-fecha-hora-cabecera pc-fecha-hora-cabecera--hora">
        <span class="pc-fecha-hora-titulo">Elegir hora</span>
      </div>
      <div class="pc-fecha-hora-columnas">
        <div class="pc-fecha-hora-columna" data-columna="horas">${horas}</div>
        <span class="pc-fecha-hora-separador">:</span>
        <div class="pc-fecha-hora-columna" data-columna="minutos">${minutos}</div>
      </div>
      <div class="pc-fecha-hora-pie">
        <button type="button" class="pc-fecha-hora-btn-pie" data-accion="ahora">Ahora</button>
        <button type="button" class="pc-fecha-hora-btn-pie" data-accion="limpiar">Limpiar</button>
        <button type="button" class="pc-fecha-hora-btn-pie pc-fecha-hora-btn-pie--principal" data-accion="listo">Listo</button>
      </div>`;

    const activoHora = popup.querySelector('[data-columna="horas"] .pc-fecha-hora-item--activo');
    if (activoHora) activoHora.scrollIntoView({ block: "center" });
    const activoMin = popup.querySelector('[data-columna="minutos"] .pc-fecha-hora-item--activo');
    if (activoMin) activoMin.scrollIntoView({ block: "center" });
  }

  popup.addEventListener("click", evento => {
    const boton2 = evento.target.closest("button");
    if (!boton2) return;

    if (boton2.dataset.hora !== undefined) {
      if (boton2.disabled) return;
      horaPend = Number(boton2.dataset.hora);
      popup.querySelectorAll('[data-columna="horas"] .pc-fecha-hora-item').forEach(el => el.classList.remove("pc-fecha-hora-item--activo"));
      boton2.classList.add("pc-fecha-hora-item--activo");
      // La disponibilidad de minutos depende de la hora elegida (ej. 09:00
      // libre pero 09:30 ocupado) -- hay que rehacer esa columna para la
      // hora recién seleccionada en vez de dejar la de la hora anterior.
      minPend = null;
      const columnaMinutos = popup.querySelector('[data-columna="minutos"]');
      if (columnaMinutos) columnaMinutos.innerHTML = generarBotonesMinutos(horaPend, null);
      return;
    }
    if (boton2.dataset.minuto !== undefined) {
      if (boton2.disabled) return;
      minPend = Number(boton2.dataset.minuto);
      popup.querySelectorAll('[data-columna="minutos"] .pc-fecha-hora-item').forEach(el => el.classList.remove("pc-fecha-hora-item--activo"));
      boton2.classList.add("pc-fecha-hora-item--activo");
      return;
    }

    switch (boton2.dataset.accion) {
      case "listo":
        if (horaPend === null) horaPend = 0;
        if (minPend === null) minPend = 0;
        confirmarSiCompleto();
        break;
      case "ahora": {
        const ahora = new Date();
        horaPend = ahora.getHours();
        minPend = ahora.getMinutes() - (ahora.getMinutes() % pasoMinutos);
        confirmarSiCompleto();
        break;
      }
      case "limpiar":
        input.value = "";
        actualizarVisible();
        cerrar();
        input.dispatchEvent(new Event("change", { bubbles: true }));
        break;
    }
  });

  boton.addEventListener("click", () => abrir(renderizarColumnas));
  boton.addEventListener("keydown", evento => {
    if (evento.key === "Enter" || evento.key === " " || evento.key === "ArrowDown") {
      evento.preventDefault();
      abrir(renderizarColumnas);
    }
  });

  actualizarVisible();

  return {
    refrescar() {
      actualizarVisible();
      boton.disabled = input.disabled;
    }
  };
}
