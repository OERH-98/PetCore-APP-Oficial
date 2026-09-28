/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/mascota_detalle_controller.js
   Controller de pages/mascota_detalle.html.
   Servicios usados: mascotas_service.js, citas_service.js,
   cartillas_service.js (vacunas), historiales_tratamientos_service.js
   ========================================================================== */
import { obtenerMascotasPorPropietario } from "../services/mascotas_service.js";
import { obtenerCitasPorMascota } from "../services/citas_service.js";
import { obtenerCartillasPorMascota } from "../services/cartillas_service.js";
import { obtenerExpedientesPorMascota } from "../services/expedientes_service.js";
import { obtenerCuidadosDeMascota } from "../services/cuidados_service.js";
import {
  iniciarLayout, requerirSesion, paramUrl, edadTexto, badge, bloqueFecha,
  retrato, vacio, fechaLarga, soloFecha, nombreEmpleado, error as vacioError,
  quitarEsqueleto, escaparHtml
} from "./utils.js";

function iniciarPestanias() {
  const botones = Array.prototype.slice.call(document.querySelectorAll("#pcTabs [data-bs-toggle='tab']"));
  if (!botones.length) return;

  const hayBootstrap = !!(window.bootstrap && window.bootstrap.Tab);

  function mostrar(boton) {
    botones.forEach(function (b) {
      const panel = document.querySelector(b.dataset.bsTarget);
      const activo = b === boton;
      b.classList.toggle("active", activo);
      b.setAttribute("aria-selected", activo ? "true" : "false");
      if (panel) {
        panel.classList.toggle("show", activo);
        panel.classList.toggle("active", activo);
      }
    });
  }

  botones.forEach(function (boton) {
    boton.addEventListener("click", function (evento) {
      evento.preventDefault();
      if (hayBootstrap) {
        window.bootstrap.Tab.getOrCreateInstance(boton).show();
      } else {
        mostrar(boton);
      }
      history.replaceState(null, "", boton.dataset.bsTarget);
    });
  });

  if (window.location.hash) {
    const inicial = botones.find(function (b) { return b.dataset.bsTarget === window.location.hash; });
    if (inicial) {
      if (hayBootstrap) window.bootstrap.Tab.getOrCreateInstance(inicial).show();
      else mostrar(inicial);
    }
  }
}

function renderizarCuidados(contenedor, datos) {
  if (!datos) {
    contenedor.innerHTML = vacio("No hay cuidados registrados para esta mascota.");
    return;
  }

  function crearSeccion(titulo, lista, msjVacio) {
    let items = lista || [];
    let html = '<h3 class="pc-subtitulo mt-3">' + titulo + '</h3>';

    if (items.length > 0) {
      items.forEach(function (c) {
        let texto = typeof c === "string" ? c : (c.cui_titulo || c.nombreDiagnostico || c.titulo || "");
        let desc = typeof c === "string" ? "" : (c.cui_descripcion || c.dgr_nota || c.men_observaciones || c.descripcion || "");

        html += '<div class="pc-registro">' +
                  '<div class="flex-grow-1">' +
                    '<p class="pc-registro-titulo mb-1">' + escaparHtml(texto) + '</p>' +
                    '<p class="mb-0 small">' + escaparHtml(desc) + '</p>' +
                  '</div>' +
                '</div>';
      });
    } else {
      html += '<p class="small">' + msjVacio + '</p>';
    }
    return html;
  }

  let htmlResult = "";
  htmlResult += crearSeccion("Cuidados generales", datos.cuidadosGenerales, "Sin consejos generales para su etapa de vida.");
  htmlResult += crearSeccion("Cuidados de su raza", datos.cuidadosRaza, "Sin consejos específicos para su raza todavía.");
  htmlResult += crearSeccion("Predisposiciones de su raza", datos.predisposiciones, "Sin predisposiciones conocidas registradas.");
  htmlResult += crearSeccion("Condiciones actuales", datos.condicionesActuales, "Sin condiciones crónicas registradas.");

  contenedor.innerHTML = htmlResult;
}

async function iniciarDetalle() {
  const carnet = document.getElementById("pcCarnet");
  if (!carnet) return;

  const sesion = await requerirSesion();
  if (!sesion) return;

  const idSolicitado = paramUrl("id");

  let mascotas = [];
  try {
    mascotas = (await obtenerMascotasPorPropietario(sesion.pro_id)) || [];
  } catch (e) {
    carnet.innerHTML = vacioError("No se pudo conectar con el servidor. Intenta más tarde.");
    quitarEsqueleto(document.getElementById("pcTituloHeader"));
    return;
  }

  const m = mascotas.find(function (x) { return Number(x.mas_id) === Number(idSolicitado); }) || mascotas[0];

  if (!m) {
    carnet.innerHTML = vacio("No se encontró información de esta mascota.");
    quitarEsqueleto(document.getElementById("pcTituloHeader"));
    return;
  }

  document.title = "Detalles de " + m.mas_nombre + " | PetCore";

  const titulo = document.getElementById("pcTituloHeader");
  if (titulo) { titulo.textContent = "Detalles de " + m.mas_nombre; quitarEsqueleto(titulo); }

  carnet.innerHTML =
    '<div class="d-flex flex-column align-items-center">' +
      retrato(m, "pc-retrato-xl") +
      '<span class="pc-eyebrow d-block mt-3">' + escaparHtml(m.nombreEspecie || "Especie no indicada") + " · " + escaparHtml(m.nombreRaza || "Raza no indicada") + "</span>" +
      '<h1 class="h3 mt-1 mb-2">' + escaparHtml(m.mas_nombre) + "</h1>" +
      badge(m.mas_estado) +
    "</div>" +
    '<dl class="pc-carnet-datos">' +
      "<div><dt>Edad</dt><dd>" + edadTexto(soloFecha(m.mas_fecha_nac)) + "</dd></div>" +
      '<div><dt>Peso</dt><dd class="pc-dato">' + (m.mas_peso_kg != null ? escaparHtml(m.mas_peso_kg + " kg") : "No registrado") + "</dd></div>" +
      "<div><dt>Sexo</dt><dd>" + escaparHtml(m.mas_genero || "No indicado") + "</dd></div>" +
    "</dl>";

  const [citas, cartillas, expedientes] = await Promise.allSettled([
    obtenerCitasPorMascota(m.mas_id),
    obtenerCartillasPorMascota(m.mas_id),
    obtenerExpedientesPorMascota(m.mas_id)
  ]);

  // --- Citas ---
  const panelCitas = document.getElementById("pcCitas");
  if (citas.status === "fulfilled") {
    const propias = (citas.value || [])
      .slice()
      .sort(function (a, b) { return new Date(b.cit_fecha_cita) - new Date(a.cit_fecha_cita); });
    panelCitas.innerHTML = propias.length
      ? propias.map(function (c) {
          return (
            '<div class="pc-registro animate__animated animate__fadeIn animate__faster">' + bloqueFecha(soloFecha(c.cit_fecha_cita)) +
              '<div class="flex-grow-1">' +
                '<p class="pc-registro-titulo mb-1">' + escaparHtml(c.cit_motivo || "") + "</p>" +
                '<p class="pc-meta mb-2"><i class="fa-solid fa-clock me-1"></i><span class="pc-dato">' + escaparHtml(c.cit_hora_inicio) +
                  '</span> · <i class="fa-solid fa-user-doctor ms-1 me-1"></i>' + escaparHtml(nombreEmpleado(c)) + "</p>" +
                badge(c.cit_estado) +
              "</div>" +
            "</div>"
          );
        }).join("")
      : vacio("Esta mascota todavía no tiene citas registradas.");
  } else {
    panelCitas.innerHTML = vacioError("No se pudieron cargar las citas.");
  }

  // --- Vacunas (cartillas) ---
  const panelVacunas = document.getElementById("pcVacunas");
  if (cartillas.status === "fulfilled") {
    const propias = cartillas.value || [];
    panelVacunas.innerHTML = propias.length
      ? propias.map(function (v) {
          const nombre = v.nombreProducto || v.car_nombre_externo || "Vacuna";
          const fecha = soloFecha(v.car_fecha_vacunacion);
          const lote = v.car_lote_aplicado || "No registrado";
          const proxima = v.car_proxima_cita_recomendada;
          const estado = v.car_estado;
          return (
            '<div class="pc-registro animate__animated animate__fadeIn animate__faster">' + bloqueFecha(fecha) +
              '<div class="flex-grow-1">' +
                '<p class="pc-registro-titulo mb-1">' + escaparHtml(nombre) + "</p>" +
                '<p class="pc-meta mb-1">Lote <span class="pc-dato">' + escaparHtml(lote) + "</span></p>" +
                (proxima ? '<p class="pc-meta mb-2">Próxima dosis: <span class="pc-dato">' + fechaLarga(soloFecha(proxima)) + "</span></p>" : "") +
                badge(estado) +
              "</div>" +
            "</div>"
          );
        }).join("")
      : vacio("Aún no hay vacunas en la cartilla digital de esta mascota.");
  } else {
    panelVacunas.innerHTML = vacioError("No se pudo cargar la cartilla de vacunas.");
  }

  // --- Historial clínico (expedientes de consulta, GET /api/expedientes/mascota/{id}) ---
  const panelHistorial = document.getElementById("pcHistorial");
  if (expedientes.status === "fulfilled") {
    const propios = (expedientes.value || [])
      .slice()
      .sort(function (a, b) { return new Date(b.exp_fecha_consulta) - new Date(a.exp_fecha_consulta); });
    panelHistorial.innerHTML = propios.length
      ? propios.map(function (h) {
          const diagnostico = h.exp_motivo_consulta || "Sin motivo registrado";
          const tipo = h.exp_tipo || "Consulta";
          const observaciones = h.exp_observacion || "";
          return (
            '<div class="pc-registro animate__animated animate__fadeIn animate__faster">' + bloqueFecha(soloFecha(h.exp_fecha_consulta)) +
              '<div class="flex-grow-1">' +
                '<p class="pc-registro-titulo mb-1">' + escaparHtml(diagnostico) + "</p>" +
                '<p class="pc-meta mb-2"><i class="fa-solid fa-user-doctor me-1"></i>' + escaparHtml(nombreEmpleado(h)) +
                  ' · <span class="badge pc-badge">' + escaparHtml(tipo) + "</span></p>" +
                '<p class="mb-0 small">' + escaparHtml(observaciones) + "</p>" +
              "</div>" +
            "</div>"
          );
        }).join("")
      : vacio("Esta mascota todavía no tiene consultas en su expediente.");
  } else {
    panelHistorial.innerHTML = vacioError("No se pudo cargar el historial clínico.");
  }

  const tabCuidados = document.getElementById("tabCuidados");
  const panelCuidados = document.getElementById("pcCuidados");
  let cuidadosCargados = false;

  if (tabCuidados && panelCuidados) {
    tabCuidados.addEventListener("shown.bs.tab", async function () {
      if (cuidadosCargados) return;
      
      panelCuidados.innerHTML = '<div class="text-center py-4 text-secondary"><span class="spinner-border spinner-border-sm me-2"></span>Cargando cuidados...</div>';
      
      try {
        const datos = await obtenerCuidadosDeMascota(m.mas_id);
        renderizarCuidados(panelCuidados, datos);
        cuidadosCargados = true;
      } catch (e) {
        panelCuidados.innerHTML = vacioError("No se pudieron cargar los cuidados.");
      }
    });
  }

  iniciarPestanias();
}

document.addEventListener("DOMContentLoaded", function () {
  iniciarLayout();
  iniciarDetalle();
});
