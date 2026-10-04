// js/cargador-header.js

function marcarMenuActivo() {
    const currentPath = window.location.pathname.toLowerCase();

    const menuMap = [
        { selector: 'a[href*="panelCategoria"]', paths: ['panelcategoria', 'formcategoria'] },
        { selector: 'a[href*="panelNiveles"]',   paths: ['panelniveles', 'formnivel'] },
        { selector: 'a[href*="panelProductos"]', paths: ['panelproductos', 'formproducto'] },
        { selector: 'a[href*="panelPedidos"]',   paths: ['panelpedidospendientes', 'panelpedidos', 'formpedidos'] },
        { selector: 'a[href*="panelHistorial"]', paths: ['panelhistorial'] }
    ];

    menuMap.forEach(item => {
        if (item.paths.some(p => currentPath.includes(p))) {
            const link = document.querySelector(item.selector);
            if (link) {
                link.classList.add('nav-admin-active');
            }
        }
    });
}


function establecerFaviconAdmin() {
    let favicon = document.querySelector("link[rel*='icon']");
    if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
    }
    favicon.type = 'image/png';
    favicon.href = '../img/logoTienda.png'; 
}

//Cargar e inyectar el header
fetch('header-admin.html')
    .then(response => response.text())
    .then(data => {
        const container = document.getElementById('header-container');
        if (container) {
            container.innerHTML = data;
            marcarMenuActivo();
            
        }
    })
    .catch(error => console.error('Error al cargar el header admin:', error));


    document.addEventListener('DOMContentLoaded', async () => {
            //Inyección dinámica del favicon en el <head> de la página
    let favicon = document.querySelector("link[rel*='icon']");
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.type = 'image/png';
    favicon.href = 'img/logoTienda.png';
    });