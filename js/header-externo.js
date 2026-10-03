// js/header-externo.js
import { db } from './firebase-config.js';
import { obtenerTotalItemsCarrito } from './carrito.js';
import { mostrarToast } from './toast.js';
import { 
  collection, 
  query, 
  where, 
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

//Importación del módulo auxiliar
import { actualizarBadgePedidosCliente } from './utils-pedidos-cliente.js';

//Función principal exportada para inicializar todo el header externo
export async function initHeader() {

  //...
  let favicon = document.querySelector("link[rel*='icon']");
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  favicon.type = 'image/png';
  favicon.href = 'img/logoTienda.png';
  //...
  actualizarBadgeCarrito();
  
  // Escuchar evento global por si cambia el carrito
  window.removeEventListener('carritoActualizado', actualizarBadgeCarrito);
  window.addEventListener('carritoActualizado', actualizarBadgeCarrito);

  //Actualizar el badge de "Mis compras"
  await actualizarBadgePedidosCliente();

  await cargarCategorias();
  await cargarNiveles();
  configurarEventosHeaderExterno();
}

function actualizarBadgeCarrito() {
  const badge = document.getElementById('carritoBadge'); 
  if (badge) badge.textContent = obtenerTotalItemsCarrito();
}

async function cargarCategorias() {
  const menuCat = document.getElementById('menuCategorias');
  if (!menuCat) return;

  //Limpieza para evitar duplicaciones
  menuCat.innerHTML = '';

  try {
    const q = query(collection(db, 'Categoria'), where('status', '==', 1));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const item = document.createElement('a');
      item.className = 'dropdown-item item-categoria';
      item.href = '#';
      item.dataset.value = docSnap.id;
      item.textContent = data.nombreCategoria;
      menuCat.appendChild(item);
    });
  } catch (error) {
    console.error("Error al cargar Categorías:", error);
  }
}

async function cargarNiveles() {
  const menuNiv = document.getElementById('menuNiveles');
  if (!menuNiv) return;

  // Limpieza para evitar duplicados
  menuNiv.innerHTML = '';

  try {
    const q = query(collection(db, 'Nivel'), where('status', '==', 1));
    const querySnapshot = await getDocs(q);

    // 1. Extraer los datos a un arreglo temporal
    const listaNiveles = [];
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      listaNiveles.push({
        id: docSnap.id,
        nombre: data.nombreNivel,
        nivelDificultad: Number(data.nivelDificultad) || 0
      });
    });

    // 2. Ordenar de menor a mayor usando nivelDificultad
    listaNiveles.sort((a, b) => a.nivelDificultad - b.nivelDificultad);

    // 3. Renderizar las opciones ya ordenadas en el DOM
    listaNiveles.forEach(nivel => {
      const item = document.createElement('a');
      item.className = 'dropdown-item item-nivel';
      item.href = '#';
      item.dataset.value = nivel.id;
      item.textContent = nivel.nombre;
      menuNiv.appendChild(item);
    });
  } catch (error) {
    console.error("Error al cargar Niveles:", error);
  }
}

function configurarEventosHeaderExterno() {
  const formBuscador = document.getElementById('formBuscadorHeader');
  const btnLupa = document.getElementById('btnBuscarHeader');

  const ejecutarBusqueda = () => {
    const inputNombre = document.getElementById('filtroNombre');
    const queryStr = inputNombre ? inputNombre.value.trim() : '';
    if (queryStr) {
      window.location.href = `index.html?buscar=${encodeURIComponent(queryStr)}`;
    } else {
      window.location.href = 'index.html';
    }
  };

  if (formBuscador) {
    formBuscador.addEventListener('submit', (e) => {
      e.preventDefault();
      ejecutarBusqueda();
    });
  }

  if (btnLupa) {
    btnLupa.addEventListener('click', (e) => {
      e.preventDefault();
      ejecutarBusqueda();
    });
  }

  const minInput = document.getElementById('filtroPrecioMin');
  const maxInput = document.getElementById('filtroPrecioMax');

  minInput?.addEventListener('input', () => {
    if (minInput.value.trim() !== '') {
      maxInput.disabled = false;
    } else {
      maxInput.value = '';
      maxInput.disabled = true;
    }
  });

  document.getElementById('menuCategorias')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('dropdown-item')) {
      e.preventDefault();
      const catId = e.target.dataset.value;
      const inputNombre = document.getElementById('filtroNombre');
      const nombreVal = inputNombre ? inputNombre.value.trim() : '';

      const params = new URLSearchParams();
      if (catId) params.set('categoria', catId);
      if (nombreVal) params.set('buscar', nombreVal);

      window.location.href = `index.html?${params.toString()}`;
    }
  });

  document.getElementById('menuNiveles')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('dropdown-item')) {
      e.preventDefault();
      const nivId = e.target.dataset.value;
      const inputNombre = document.getElementById('filtroNombre');
      const nombreVal = inputNombre ? inputNombre.value.trim() : '';

      const params = new URLSearchParams();
      if (nivId) params.set('nivel', nivId);
      if (nombreVal) params.set('buscar', nombreVal);

      window.location.href = `index.html?${params.toString()}`;
    }
  });

  document.getElementById('btnAplicarPrecio')?.addEventListener('click', (e) => {
    e.preventDefault();
    const inputNombre = document.getElementById('filtroNombre');

    const valMin = minInput && minInput.value !== '' ? parseFloat(minInput.value) : null;
    const valMax = maxInput && maxInput.value !== '' ? parseFloat(maxInput.value) : null;
    const nombreVal = inputNombre ? inputNombre.value.trim() : '';

    if (valMin !== null && valMin < 0) {
      mostrarToast('El precio mínimo no puede ser negativo.', 'warning');
      return;
    }

    if (valMin !== null && valMax !== null && valMax <= valMin) {
      mostrarToast('El precio máximo debe ser mayor al precio mínimo.', 'warning');
      return;
    }

    const params = new URLSearchParams();
    if (minInput && minInput.value) params.set('pMin', minInput.value);
    if (maxInput && maxInput.value) params.set('pMax', maxInput.value);
    if (nombreVal) params.set('buscar', nombreVal);

    window.location.href = `index.html?${params.toString()}`;
  });
}