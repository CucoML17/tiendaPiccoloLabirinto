// js/header-admin.js
import { cerrarSesion } from './auth-guard.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', (event) => {
            event.preventDefault(); // Evita la recarga por el href="#"
            cerrarSesion();
        });
    }
});