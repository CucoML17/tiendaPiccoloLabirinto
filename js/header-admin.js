// js/header-admin.js
import { cerrarSesion } from './auth-guard.js';

// Delegación de eventos a nivel de documento
document.addEventListener('click', (event) => {
    // Verificamos si el elemento cliqueado (o su ancestro) es el botón de salir
    const btnCerrarSesion = event.target.closest('#btnCerrarSesion');

    if (btnCerrarSesion) {
        event.preventDefault(); // Detiene el comportamiento predeterminado del href="#"
        cerrarSesion();
    }
});