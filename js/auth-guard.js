// js/auth-guard.js

export function verificarSesionAdmin() {
    const sesionRaw = localStorage.getItem('admin_session');

    if (!sesionRaw) {
        expulsarAlLogin();
        return null;
    }

    try {
        const sesion = JSON.parse(sesionRaw);

        if (!sesion || !sesion.token || sesion.rol !== 'Administrador') {
            expulsarAlLogin();
            return null;
        }

        // Hace visible el cuerpo de la página
        document.documentElement.style.visibility = 'visible';
        document.documentElement.style.opacity = '1';

        return sesion;
    } catch (e) {
        expulsarAlLogin();
        return null;
    }
}

export function cerrarSesion() {
    localStorage.removeItem('admin_session');
    localStorage.removeItem('redirect_after_login');
    window.location.href = 'index.html';
}

function expulsarAlLogin() {
    localStorage.removeItem('admin_session');

    const paginaActual = window.location.pathname.split('/').pop();
    if (paginaActual && paginaActual !== 'login.html') {
        localStorage.setItem('redirect_after_login', paginaActual + window.location.search);
    }

    window.location.replace('login.html');
}

// Exponer globalmente para que sea invocado directamente sin importar módulos
window.cerrarSesion = cerrarSesion;

// Ejecución automática al cargar el módulo
verificarSesionAdmin();