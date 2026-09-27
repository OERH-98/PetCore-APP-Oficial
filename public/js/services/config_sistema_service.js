const API_URL = "https://petcore-8afada45fabc.herokuapp.com/api/cfgs_sistema";

export async function obtenerConfiguracionSistema() {
    try {

        const respuesta = await fetch(API_URL);
        if (!respuesta.ok) {
            console.error("Error al traer la configuracion");
            throw new Error("Error al obtener los registros");
        }

        const registros = await respuesta.json();
        return registros;
    }
    catch (error) {
        console.error("Error al obtener los registros" + error);
        throw error;
    }
}

/* Devuelve la configuración vigente (la última registrada) o null --
   usada por apariencia_utils.js para el fondo institucional (imagen + su
   interruptor "mostrar imagen"), que solo existe en el registro más
   reciente. */
export async function obtenerConfiguracionActual() {
    try {
        const lista = await obtenerConfiguracionSistema();
        if (!lista || lista.length === 0) return null;
        return lista.reduce((a, b) => (Number(b.sis_id) > Number(a.sis_id) ? b : a));
    } catch (error) {
        console.error("Error en obtenerConfiguracionActual:", error);
        return null;
    }
}
