/* ==========================================================================
   PetCore — Portal de Propietarios
   js/utils/selector_personalizado.js
   Reemplaza visualmente un <select> por un combo propio -- Bootstrap no
   deja re-pintar el hover/padding/bordes de las <option> de un <select>
   nativo con CSS (el navegador dibuja esa lista con el menú del propio
   sistema operativo), así que la única forma de tener el mismo look en
   claro/oscuro y el mismo hover azul suave en todas las opciones es que la
   lista tampoco sea un <select> nativo.

   El sustituto visible es un <button type="button">, no un <input> -- un
   input (aunque sea readonly + inputmode="none") igual dispara el teclado
   virtual un instante en ciertas combinaciones de Android/iOS, porque
   sigue siendo un campo de texto para el sistema operativo. Un <button>
   nunca es un campo de texto, así que jamás levanta teclado, sin importar
   plataforma: es la única forma 100% confiable de que este select "normal"
   se sienta como un select y no como un campo para escribir.

   El <select> original NO se elimina: se oculta pero sigue siendo la
   fuente de verdad (mismo id, mismo .value, mismos eventos "change"), así
   el resto del código (validaciones, armado del DTO) sigue funcionando
   intacto sin tocar nada más. Mismo patrón que crearSelectPersonalizado()
   del frontend de escritorio, adaptado a los nombres/clases de este
   portal (no hace falta la variante "buscable": las listas del portal de
   propietarios son cortas -- sus mascotas, servicios, horarios -- así que
   alcanza con abrir/cerrar por clic o toque).
   ========================================================================== */

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

export function crearSelectPersonalizado(select, opciones = {}) {
  if (!select || select.dataset.selectorPersonalizadoListo === "1") return null;
  select.dataset.selectorPersonalizadoListo = "1";

  const placeholder = opciones.placeholder || "Seleccionar...";
  const clasesOriginales = select.className;
  const ariaLabel = select.getAttribute("aria-label") || "";

  // El select real se oculta pero sigue en el DOM (fuente de verdad)
  select.classList.add("pc-select-oculto", "d-none");
  select.setAttribute("aria-hidden", "true");
  select.tabIndex = -1;

  // Botón que reemplaza visualmente al select -- se ve y se comporta igual
  // que un <select> (clic/toque abre la lista), pero nunca es un campo de
  // texto, así que nunca levanta teclado.
  const boton = document.createElement("button");
  boton.type = "button";
  if (select.id) boton.id = `${select.id}_VISUAL`;
  boton.className = `${clasesOriginales} pc-select-input`;
  if (ariaLabel) boton.setAttribute("aria-label", ariaLabel);
  boton.setAttribute("role", "combobox");
  boton.setAttribute("aria-expanded", "false");
  boton.setAttribute("aria-haspopup", "listbox");

  select.insertAdjacentElement("afterend", boton);

  // Si había una <label for="..."> apuntando al select, ahora apunta al botón
  if (select.id && boton.id) {
    const etiqueta = document.querySelector(`label[for="${select.id}"]`);
    if (etiqueta) etiqueta.setAttribute("for", boton.id);
  }

  // La lista se monta en <body> con position:fixed, calculada con
  // getBoundingClientRect(): así nunca queda atrapada detrás de una tarjeta,
  // un modal u otro contenedor con su propio contexto de apilamiento.
  const lista = document.createElement("ul");
  lista.className = "dropdown-menu pc-select-lista";
  lista.setAttribute("role", "listbox");
  document.body.appendChild(lista);

  // Si el botón está cerca del borde inferior de la pantalla, la lista
  // abierta hacia abajo con su alto máximo de siempre (240px) quedaba
  // cortada por el borde de la pantalla -- se veía la primera opción o dos
  // nada más, sin forma de hacer scroll hasta el resto (la lista es
  // position:fixed, no se mueve con el scroll de la página, y esta ya se
  // cierra apenas la página se desplaza). La solución es la misma que usa
  // cualquier <select> nativo: si no hay espacio abajo, se abre hacia
  // arriba, y en ambos casos el alto máximo se recorta al espacio real
  // disponible en esa dirección para que siempre quede 100% visible.
  function posicionarLista() {
    const rect = boton.getBoundingClientRect();
    const margen = 4;
    const alturaMaxima = 240;
    const respiro = 8; // separación del borde de la pantalla
    const espacioAbajo = window.innerHeight - rect.bottom - margen - respiro;
    const espacioArriba = rect.top - margen - respiro;

    lista.style.left = `${rect.left}px`;
    lista.style.width = `${rect.width}px`;

    if (espacioAbajo >= alturaMaxima || espacioAbajo >= espacioArriba) {
      lista.style.top = `${rect.bottom + margen}px`;
      lista.style.bottom = "auto";
      lista.style.maxHeight = `${Math.max(120, Math.min(alturaMaxima, espacioAbajo))}px`;
    } else {
      lista.style.top = "auto";
      lista.style.bottom = `${window.innerHeight - rect.top + margen}px`;
      lista.style.maxHeight = `${Math.max(120, Math.min(alturaMaxima, espacioArriba))}px`;
    }
  }

  function textoDeOpcionActual() {
    const seleccionada = select.options[select.selectedIndex];
    return seleccionada ? seleccionada.text : "";
  }

  // El botón no tiene placeholder nativo -- mientras no haya selección se
  // pinta el texto guía con una clase aparte (mismo gris que usaba antes
  // el placeholder del input).
  function pintarTextoActual() {
    const texto = textoDeOpcionActual();
    boton.textContent = texto || placeholder;
    boton.classList.toggle("pc-select-input--vacio", !texto);
  }

  function construirLista() {
    const opcionesDisponibles = Array.from(select.options);
    lista.innerHTML = "";

    if (!opcionesDisponibles.length) {
      lista.innerHTML = `<li><span class="dropdown-item disabled">Sin opciones</span></li>`;
      return;
    }

    opcionesDisponibles.forEach(opcion => {
      const esActual = opcion.value === select.value;
      const esVacia = opcion.disabled;
      const li = document.createElement("li");
      li.innerHTML = `<button type="button" class="dropdown-item${esActual ? " active" : ""}${esVacia ? " disabled" : ""}"
                data-valor="${escaparHtml(opcion.value)}">${escaparHtml(opcion.text)}</button>`;
      lista.appendChild(li);
    });
  }

  function abrirLista() {
    if (boton.disabled) return;
    construirLista();
    posicionarLista();
    lista.classList.add("show");
    boton.setAttribute("aria-expanded", "true");
  }

  function cerrarLista() {
    lista.classList.remove("show");
    boton.setAttribute("aria-expanded", "false");
  }

  function seleccionarOpcion(valor) {
    select.value = valor;
    pintarTextoActual();
    cerrarLista();
    boton.focus();
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function alternarLista() {
    lista.classList.contains("show") ? cerrarLista() : abrirLista();
  }

  boton.addEventListener("click", alternarLista);
  boton.addEventListener("keydown", evento => {
    if (evento.key === "Enter" || evento.key === " " || evento.key === "ArrowDown") {
      evento.preventDefault();
      abrirLista();
    } else if (evento.key === "Escape") {
      cerrarLista();
    }
  });

  // mousedown (no click) para que dispare antes que el blur del botón
  lista.addEventListener("mousedown", evento => {
    const item = evento.target.closest(".dropdown-item:not(.disabled)");
    if (!item) return;
    evento.preventDefault();
    seleccionarOpcion(item.dataset.valor);
  });

  boton.addEventListener("blur", () => {
    setTimeout(cerrarLista, 120);
  });

  // Se cierra si la página se desplaza o cambia de tamaño mientras está
  // abierta (fase de captura para detectar el scroll de cualquier
  // contenedor, con excepción del scroll interno de la propia lista).
  window.addEventListener("scroll", evento => {
    if (!lista.classList.contains("show")) return;
    if (evento.target === lista || lista.contains(evento.target)) return;
    cerrarLista();
  }, true);
  window.addEventListener("resize", () => {
    if (lista.classList.contains("show")) cerrarLista();
  });

  // Estado inicial
  pintarTextoActual();
  boton.disabled = select.disabled;

  return {
    // Llamar después de repintar las <option> del select o de cambiar su
    // .value por código, para que el botón refleje lo actual.
    refrescar() {
      pintarTextoActual();
      boton.disabled = select.disabled;
    }
  };
}
