// js/header-js.js
import { db } from './firebase-config.js';
import { obtenerTotalItemsCarrito } from './carrito.js';
import { 
  collection, 
  query, 
  where, 
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Mapas globales exportables para mapear IDs a nombres en las tarjetas
export const categoriasMap = new Map();
export const nivelesMap = new Map();

//Inicializa el Header completo y configura su comportamiento según la vista actual.
export async function inicializarHeader(callbackAlFiltrar = null) {
  await cargarHeaderHTML();
  
  // Escuchar eventos de carrito
  window.addEventListener('carritoActualizado', actualizarBadgeCarrito);
  actualizarBadgeCarrito();

  // Cargar colecciones en los dropdowns
  await cargarCategorias();
  await cargarNiveles();

  // Configurar los listeners de búsqueda y navegación
  configurarEventosHeader(callbackAlFiltrar);
}

//Carga el HTML del header en el contenedor
async function cargarHeaderHTML() {
  try {
    const response = await fetch('header.html');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const html = await response.text();
    const container = document.getElementById('header-container');
    if (container) {
      container.innerHTML = html;
    }
  } catch (error) {
    console.error('Error al cargar el header.html:', error);
  }
}

//Actualiza el badge del carrito
export function actualizarBadgeCarrito() {
  const badge = document.getElementById('carritoBadge'); 
  if (badge) {
    badge.textContent = obtenerTotalItemsCarrito();
  }
}

// Carga categorías activas desde Firestore
async function cargarCategorias() {
  const menuCat = document.getElementById('menuCategorias');
  if (!menuCat) return;

  try {
    const q = query(collection(db, 'Categoria'), where('status', '==', 1));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      categoriasMap.set(docSnap.id, data.nombreCategoria);

      const item = document.createElement('a');
      item.className = 'dropdown-item item-categoria';
      item.href = '#';
      item.dataset.value = docSnap.id;
      item.textContent = data.nombreCategoria;

      menuCat.appendChild(item);
    });
  } catch (error) {
    console.error("Error al cargar Categorías en el Header:", error);
  }
}

//Carga niveles activos desde Firestore
async function cargarNiveles() {
  const menuNiv = document.getElementById('menuNiveles');
  if (!menuNiv) return;

  try {
    const q = query(collection(db, 'Nivel'), where('status', '==', 1));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      nivelesMap.set(docSnap.id, { 
        nombre: data.nombreNivel, 
        color: data.color 
      });

      const item = document.createElement('a');
      item.className = 'dropdown-item item-nivel';
      item.href = '#';
      item.dataset.value = docSnap.id;
      item.textContent = data.nombreNivel;

      menuNiv.appendChild(item);
    });
  } catch (error) {
    console.error("Error al cargar Niveles en el Header:", error);
  }
}

// Determina si la página actual es la vista principal (index)
function esPaginaIndex() {
  const path = window.location.pathname;
  return path.endsWith('index.html') || path.endsWith('/') || path === '';
}

//Registra todos los eventos del buscador y los dropdowns del Header
function configurarEventosHeader(callbackAlFiltrar) {
  const formBuscador = document.getElementById('formBuscadorHeader');
  const inputNombre = document.getElementById('filtroNombre');

  // 1. Evento de Búsqueda por Nombre (al enviar formulario o escribir)
  if (formBuscador) {
    formBuscador.addEventListener('submit', (e) => {
      e.preventDefault();
      const queryStr = inputNombre ? inputNombre.value.trim() : '';

      if (esPaginaIndex()) {
        if (typeof callbackAlFiltrar === 'function') callbackAlFiltrar();
      } else {
        // Si es en página externa, redirigimos a index.html con el parámetro de búsqueda
        window.location.href = `index.html?buscar=${encodeURIComponent(queryStr)}`;
      }
    });
  }

  // Si es en el índice, filtramos también mientras se escribe
  if (inputNombre && esPaginaIndex()) {
    inputNombre.addEventListener('input', () => {
      if (typeof callbackAlFiltrar === 'function') callbackAlFiltrar();
    });
  }

  // 2. Selección de Categoría
  document.getElementById('menuCategorias')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('dropdown-item')) {
      e.preventDefault();
      const catId = e.target.dataset.value;

      if (esPaginaIndex()) {
        const catNombre = catId ? e.target.textContent : 'Categorías';
        const dropBtn = document.getElementById('dropCategorias');
        if (dropBtn) dropBtn.innerHTML = `${catNombre} <i class="fas fa-chevron-down small ml-1"></i>`;

        document.querySelectorAll('#menuCategorias .dropdown-item').forEach(el => el.classList.remove('active'));
        e.target.classList.add('active');

        if (typeof callbackAlFiltrar === 'function') callbackAlFiltrar();
      } else {
        window.location.href = catId ? `index.html?categoria=${encodeURIComponent(catId)}` : 'index.html';
      }
    }
  });

  // 3. Selección de Nivel
  document.getElementById('menuNiveles')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('dropdown-item')) {
      e.preventDefault();
      const nivId = e.target.dataset.value;

      if (esPaginaIndex()) {
        const nivNombre = nivId ? e.target.textContent : 'Niveles';
        const dropBtn = document.getElementById('dropNiveles');
        if (dropBtn) dropBtn.innerHTML = `${nivNombre} <i class="fas fa-chevron-down small ml-1"></i>`;

        document.querySelectorAll('#menuNiveles .dropdown-item').forEach(el => el.classList.remove('active'));
        e.target.classList.add('active');

        if (typeof callbackAlFiltrar === 'function') callbackAlFiltrar();
      } else {
        window.location.href = nivId ? `index.html?nivel=${encodeURIComponent(nivId)}` : 'index.html';
      }
    }
  });
}