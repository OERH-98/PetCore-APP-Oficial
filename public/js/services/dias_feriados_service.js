/* ==========================================================================
   PetCore — Portal de Propietarios
   js/services/dias_feriados_service.js
   Llamadas HTTP a /api/dias_feriados. Solo lectura: el propietario nunca
   registra ni edita feriados (eso es exclusivo del admin en Frontend-PETCORE)
   -- este service solo trae la lista para deshabilitar esas fechas al
   agendar una cita, ver nueva_cita_controller.js.
   ========================================================================== */
const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/dias_feriados";

export async function obtenerDiasFeriados() {
    try {
        const respuesta = await fetch(API_URL);

        if (!respuesta.ok) {
            console.error("Error al obtener los días feriados");
            throw new Error("No se pudieron cargar los días feriados.");
        }

        return await respuesta.json();
    } catch (error) {
        console.error("Error al obtener los días feriados:", error);
        throw error;
    }
}
