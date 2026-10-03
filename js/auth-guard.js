// js/auth-guard.js

/**
 * Verifica si hay una sesión administrativa activa en localStorage.
 * De no ser así, guarda la página intentada y redirige inmediatamente al login.
 */
export function verificarSesionAdmin() {
    const sesionRaw = localStorage.getItem('admin_session');

    if (!sesionRaw) {
        expulsarAlLogin();
        return null;
    }

    try {
        const sesion = JSON.parse(sesionRaw);

        // Verificamos vigencia y rol
        if (!sesion || !sesion.token || sesion.rol !== 'Administrador') {
            expulsarAlLogin();
            return null;
        }

        return sesion;
    } catch (e) {
        expulsarAlLogin();
        return null;
    }
}

//Cierra la sesión manualmente borrando localStorage y redirige a index.html
export function cerrarSesion() {
    localStorage.removeItem('admin_session');
    localStorage.removeItem('redirect_after_login');
    window.location.href = 'index.html'; //Redirige a la página principal, la de la tienda
}

function expulsarAlLogin() {
    localStorage.removeItem('admin_session');

    //Guardamos la página que intentaba visitar (si no es el propio login)
    const paginaActual = window.location.pathname.split('/').pop();
    if (paginaActual && paginaActual !== 'login.html') {
        localStorage.setItem('redirect_after_login', paginaActual + window.location.search);
    }

    //Previene que quede cargada la página protegida en el historial
    window.location.replace('login.html');
}

//Ejecución automática al importar
verificarSesionAdmin();