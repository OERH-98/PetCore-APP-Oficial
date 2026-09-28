/* ==========================================================================
   PetCore — Portal de Propietarios
   js/controllers/nueva_cita_controller.js
   Controller de pages/nueva_cita.html.
   Servicios usados: mascotas_service.js (mascotas del propietario),
   servicios_service.js (servicios activos), empleados_service.js
   (veterinarios), citas_service.js (citas existentes + crear).

   El propietario NO elige veterinario: CitasDTO exige cit_emp_id, pero no
   tiene forma de saber quién está de turno. Se asigna automáticamente un
   veterinario activo cuyo turno cubra la hora elegida y que no tenga ya una
   cita a esa misma fecha/hora — ver asignarVeterinario() más abajo.

   Limitación conocida: el turno (Matutino/Vespertino/Nocturno) es solo un
   bloque de horario del día, no tiene noción de día de la semana ni de
   permisos/vacaciones, así que esto es una aproximación razonable, no una
   disponibilidad exacta. Por eso el formulario ya avisa que recepción
   confirma la cita por WhatsApp antes de la fecha elegida.
   ========================================================================== */
import { obtenerMascotasPorPropietario } from "../services/mascotas_service.js";
import { obtenerServiciosActivos } from "../services/servicios_service.js";
import { obtenerEmpleados } from "../services/empleados_service.js";
import { obtenerCitas, crearCita } from "../services/citas_service.js";
import { obtenerDiasFeriados } from "../services/dias_feriados_service.js";
import { iniciarLayout, requerirSesion, dinero, soloFecha, esFechaFeriado, mostrarToast, escaparHtml } from "./utils.js";
import { crearSelectPersonalizado } from "../utils/selector_personalizado.js";
import { crearFechaPersonalizada, crearHoraPersonalizada } from "../utils/fecha_hora_personalizada.js";

// hora, turnoInicio y turnoFin llegan como "HH:mm". El turno Nocturno cruza
// medianoche (ej. 23:00–07:00), así que no basta un simple inicio <= hora < fin.
function turnoCubreHora(turnoInicio, turnoFin, hora) {
  if (turnoInicio <= turnoFin) {
    return hora >= turnoInicio && hora < turnoFin;
  }
  return hora >= turnoInicio || hora < turnoFin;
}

// ser_categoria viene restringido en el backend a este set fijo
// (@Pattern en ServiciosDTO) — se usa para las etiquetas en español de los chips.
const CATEGORIA_ETIQUETA = {
  Medico: "Médico",
  Cirugia: "Cirugía",
  Estetica: "Estética",
  Farmacia: "Farmacia",
  Preventivo: "Preventivo",
  Diagnostico: "Diagnóstico",
  Otro: "Otro"
};

// Un horario queda "ocupado" para el propietario cuando NINGÚN veterinario
// de turno en ese momento tiene el hueco libre -- mismo criterio que
// asignarVeterinario(), pero evaluado para los 48 bloques de 30 min del día
// en vez de uno solo, para poder deshabilitar los horarios sin disponibilidad
// en el selector de hora (ver crearHoraPersonalizada en nueva_cita_controller.js).
function calcularHorasOcupadas(empleados, citas, fecha) {
  const ocupadas = new Set();
  if (!fecha) return ocupadas;

  const vetsActivos = empleados.filter(function (e) {
    return e.nombreRol === "Veterinario" && e.emp_estado === "Activo" &&
      e.horaInicioTurno && e.horaFinTurno;
  });

  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const horaStr = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
      const hayVetLibre = vetsActivos.some(function (vet) {
        if (!turnoCubreHora(vet.horaInicioTurno, vet.horaFinTurno, horaStr)) return false;
        return !citas.some(function (c) {
          return Number(c.cit_emp_id) === Number(vet.emp_id) &&
            soloFecha(c.cit_fecha_cita) === fecha &&
            c.cit_hora_inicio === horaStr &&
            c.cit_estado !== "Cancelada" && c.cit_estado !== "No Presentado";
        });
      });
      if (!hayVetLibre) ocupadas.add(horaStr);
    }
  }
  return ocupadas;
}

function asignarVeterinario(empleados, citas, fecha, hora) {
  const candidatos = empleados.filter(function (e) {
    return e.nombreRol === "Veterinario" &&
      e.emp_estado === "Activo" &&
      e.horaInicioTurno && e.horaFinTurno &&
      turnoCubreHora(e.horaInicioTurno, e.horaFinTurno, hora);
  });

  return candidatos.find(function (vet) {
    const ocupado = citas.some(function (c) {
      return Number(c.cit_emp_id) === Number(vet.emp_id) &&
        soloFecha(c.cit_fecha_cita) === fecha &&
        c.cit_hora_inicio === hora &&
        c.cit_estado !== "Cancelada" && c.cit_estado !== "No Presentado";
    });
    return !ocupado;
  });
}

async function iniciarNuevaCita() {
  const form = document.getElementById("pcFormCita");
  if (!form) return;

  const sesion = await requerirSesion();
  if (!sesion) return;

  const selMascota = document.getElementById("pcCitaMascota");
  const selCategoria = document.getElementById("pcCitaServicioCategoria");
  const selServicio = document.getElementById("pcCitaServicio");
  const fecha = document.getElementById("pcCitaFecha");
  const hora = document.getElementById("pcCitaHora");
  const motivo = document.getElementById("pcCitaMotivo");
  const boton = document.getElementById("pcBtnAgendar");
  const textoBotonOriginal = boton.innerHTML;

  const personalizadoMascota = crearSelectPersonalizado(selMascota, { placeholder: "Elige una mascota" });
  const personalizadoCategoria = crearSelectPersonalizado(selCategoria, { placeholder: "Todas las categorías" });
  const personalizadoServicio = crearSelectPersonalizado(selServicio, { placeholder: "Elige un servicio" });

  let mascotas = [];
  let servicios = [];
  let empleados = [];
  let citas = [];
  let feriados = [];

  // Se recalcula solo cuando cambia la fecha elegida (no en cada botón del
  // popup) -- empleados/citas se leen del cierre, así que ya reflejan los
  // datos cargados aunque crearHoraPersonalizada() se llame antes de que
  // termine el Promise.all de abajo.
  let cacheHorasOcupadas = { fecha: null, set: new Set() };
  function horasOcupadasPara(fechaStr) {
    if (cacheHorasOcupadas.fecha !== fechaStr) {
      cacheHorasOcupadas = { fecha: fechaStr, set: calcularHorasOcupadas(empleados, citas, fechaStr) };
    }
    return cacheHorasOcupadas.set;
  }

  crearHoraPersonalizada(hora, {
    placeholder: "Elige una hora",
    estaDeshabilitada: function (horaStr) { return horasOcupadasPara(fecha.value).has(horaStr); }
  });
  crearFechaPersonalizada(fecha, {
    placeholder: "Elige una fecha",
    estaDeshabilitada: function (fechaISO) { return esFechaFeriado(feriados, fechaISO); }
  });
  try {
    [mascotas, servicios, empleados, citas] = await Promise.all([
      obtenerMascotasPorPropietario(sesion.pro_id),
      obtenerServiciosActivos(),
      obtenerEmpleados(),
      obtenerCitas()
    ]);
    mascotas = mascotas || [];
    servicios = servicios || [];
    empleados = empleados || [];
    citas = citas || [];
  } catch (e) {
    selMascota.innerHTML = '<option value="" selected disabled>No se pudo cargar la información</option>';
    selServicio.innerHTML = '<option value="" selected disabled>No se pudo cargar la información</option>';
    personalizadoMascota?.refrescar();
    personalizadoServicio?.refrescar();
    boton.disabled = true;
    return;
  }

  // Aparte del Promise.all de arriba: no es crítico para poder agendar --
  // si falla, simplemente no se deshabilita ningún día en el calendario y
  // el backend igual rechaza un feriado al enviar el formulario.
  try {
    feriados = (await obtenerDiasFeriados()) || [];
  } catch (e) {
    console.warn("No se pudieron cargar los días feriados:", e);
  }

  if (!mascotas.length) {
    selMascota.innerHTML = '<option value="" selected disabled>Aún no tienes mascotas registradas</option>';
    personalizadoMascota?.refrescar();
    boton.disabled = true;
    return;
  }

  selMascota.innerHTML = '<option value="" selected disabled>Elige una mascota</option>' +
    mascotas.map(function (m) {
      return '<option value="' + m.mas_id + '">' + escaparHtml(m.mas_nombre) + (m.nombreRaza ? " · " + escaparHtml(m.nombreRaza) : "") + "</option>";
    }).join("");
  personalizadoMascota?.refrescar();

  // --- Filtro de servicios por categoría (ser_categoria) ---
  const categoriasPresentes = servicios
    .map(function (s) { return s.ser_categoria; })
    .filter(function (c, i, arr) { return c && arr.indexOf(c) === i; });

  selCategoria.innerHTML = '<option value="">Todas las categorías</option>' +
    categoriasPresentes.map(function (c) {
      return '<option value="' + c + '">' + escaparHtml(CATEGORIA_ETIQUETA[c] || c) + "</option>";
    }).join("");
  personalizadoCategoria?.refrescar();

  function repintarServicios() {
    const categoriaActiva = selCategoria.value;
    const filtrados = categoriaActiva
      ? servicios.filter(function (s) { return s.ser_categoria === categoriaActiva; })
      : servicios;

    const seleccionPrevia = selServicio.value;

    selServicio.innerHTML = filtrados.length
      ? '<option value="" selected disabled>Elige un servicio</option>' +
        filtrados.map(function (s) {
          return '<option value="' + s.ser_id + '">' + escaparHtml(s.ser_nombre) + " — " + dinero(s.ser_costo) + "</option>";
        }).join("")
      : '<option value="" selected disabled>No hay servicios en esta categoría</option>';

    // Conserva la selección si el servicio elegido sigue en el filtro actual
    if (filtrados.some(function (s) { return String(s.ser_id) === seleccionPrevia; })) {
      selServicio.value = seleccionPrevia;
    } else {
      const costo = document.getElementById("pcCitaCosto");
      if (costo) costo.classList.add("d-none");
    }
    personalizadoServicio?.refrescar();
  }

  selCategoria.addEventListener("change", repintarServicios);

  repintarServicios();

  // La cita no puede quedar en el pasado
  const hoy = new Date();
  const isoHoy = hoy.getFullYear() + "-" +
    String(hoy.getMonth() + 1).padStart(2, "0") + "-" +
    String(hoy.getDate()).padStart(2, "0");
  fecha.min = isoHoy;

  // Las citas son siempre en punto o y media (step="1800" en el HTML, mismo
  // intervalo que TRG_CIT_VALIDAR_ESPACIADO en la BD) y, además, el selector
  // deshabilita en vivo los horarios sin ningún veterinario libre (ver
  // horasOcupadasPara/calcularHorasOcupadas arriba) -- de todas formas el
  // backend es quien tiene la última palabra (asignarVeterinario abajo +
  // la validación de 30 min en CitasService), esto es solo para no dejar
  // elegir a simple vista un horario que se sabe de antemano que fallará.

  // Mostrar el costo del servicio elegido
  selServicio.addEventListener("change", function () {
    const s = servicios.find(function (x) { return Number(x.ser_id) === Number(selServicio.value); });
    const costo = document.getElementById("pcCitaCosto");
    if (s && costo) {
      costo.textContent = "Costo estimado del servicio: " + dinero(s.ser_costo) + " más IVA.";
      costo.classList.remove("d-none");
    }
  });

  boton.addEventListener("click", function (evento) {
    evento.preventDefault();

    // El textarea es "required", pero eso solo bloquea el string vacío, no
    // uno de solo espacios. Se recorta antes de validar para que ese caso
    // también quede marcado como inválido en vez de viajar como "" al backend.
    motivo.value = motivo.value.trim();
    motivo.setCustomValidity(motivo.value ? "" : "El motivo no puede quedar vacío.");

    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      const faltante = form.querySelector(":invalid");
      if (faltante) faltante.focus();
      return;
    }

    if (esFechaFeriado(feriados, fecha.value)) {
      mostrarToast("warning", "Ese día es feriado y la clínica no atiende. Elige otra fecha.");
      return;
    }

    const vet = asignarVeterinario(empleados, citas, fecha.value, hora.value);
    if (!vet) {
      mostrarToast("warning", "No hay veterinarios disponibles a esa hora. Elige otro horario.");
      return;
    }

    const nuevaCita = {
      cit_mas_id: Number(selMascota.value),
      cit_emp_id: Number(vet.emp_id),
      cit_ser_id: Number(selServicio.value),
      cit_fecha_cita: fecha.value,
      cit_hora_inicio: hora.value,
      cit_motivo: motivo.value.trim(),
      cit_estado: "Agendada",
      // Columna NOT NULL en Oracle que el backend no autogenera.
      cit_fecha_registro: isoHoy
    };

    boton.disabled = true;
    boton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Agendando';

    crearCita(nuevaCita)
      .then(function (respuesta) {
        if (!respuesta || respuesta.success === false) {
          throw new Error((respuesta && respuesta.message) || "El servidor rechazó los datos");
        }
        // Se espera a que el toast se vea antes de salir de la página.
        mostrarToast("success", "Cita agendada con éxito").then(function () {
          window.location.href = "citas.html";
        });
      })
      .catch(function () {
        mostrarToast("error", "No se pudo agendar la cita. Intenta nuevamente.");
        boton.disabled = false;
        boton.innerHTML = textoBotonOriginal;
      });
  });
}

document.addEventListener("DOMContentLoaded", function () {
  iniciarLayout();
  iniciarNuevaCita();
});
