// js/utils-dispositivo.js

const CLAVE_LOCAL_STORAGE = 'idCliente';

//Genera  un UUID único para este navegador/dispositivo en localStorage
export function obtenerOcrearIdCliente() {
    let idCliente = localStorage.getItem(CLAVE_LOCAL_STORAGE);
    if (!idCliente) {
        idCliente = 'cli_' + crypto.randomUUID();
        localStorage.setItem(CLAVE_LOCAL_STORAGE, idCliente);
    }
    return idCliente;
}

//Sobreescribe explícitamente el idCliente en localStorage.
export function guardarIdCliente(nuevoId) {
    if (nuevoId) {
        localStorage.setItem(CLAVE_LOCAL_STORAGE, nuevoId);
    }
}


 //Obtiene la IP pública del usuario desde ipify API.
 //Retorna '0.0.0.0' si falla la conexión o si hay un bloqueador de anuncios.

export async function obtenerIpPublica() {
    try {
        const respuesta = await fetch('https://api.ipify.org?format=json');
        if (!respuesta.ok) throw new Error('No se pudo obtener la IP');
        const data = await respuesta.json();
        return data.ip;
    } catch (error) {
        console.warn('No se pudo determinar la IP pública:', error);
        return '0.0.0.0'; //Valor fallback en caso de error/offline
    }
}