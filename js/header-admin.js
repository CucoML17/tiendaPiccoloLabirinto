// js/header-admin.js
import { cerrarSesion } from './auth-guard.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');

    let favicon = document.querySelector("link[rel*='icon']");
    if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
    }
    favicon.type = 'image/png';
    favicon.href = '../img/logoTienda.png'; 

    
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', (event) => {
            event.preventDefault(); // Evita la recarga por el href="#"
            cerrarSesion();
        });
    }
});