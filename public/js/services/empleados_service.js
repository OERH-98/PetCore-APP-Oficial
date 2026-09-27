const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/empleados";

// Usado por nueva_cita.html para asignar automáticamente un veterinario
// disponible en el turno elegido -- ver asignarVeterinario() en
// nueva_cita_controller.js.
export async function obtenerEmpleados() {
    try {
        const respuesta = await fetch(API_URL);
        if (!respuesta.ok) {
            console.error("Error al obtener los registros");
            throw new Error("Error al obtener los empleados");
        }

        const registros = await respuesta.json();
        return registros;
    }
    catch (error) {
        console.error("Error al obtener los registros: " + error);
        throw error;
    }
}
