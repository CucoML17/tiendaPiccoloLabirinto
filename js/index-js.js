// js/index-js.js
import { db } from './firebase-config.js';
import { obtenerTotalItemsCarrito } from './carrito.js';

import { 
  collection, 
  query, 
  where, 
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { mostrarToast } from './toast.js';
import { inicializarModalDetalle, abrirModalDetalle } from './modal-detalle-producto.js';

import { actualizarBadgePedidosCliente } from './utils-pedidos-cliente.js';

// Estado local
let productosLista = [];
const categoriasMap = new Map();
const nivelesMap = new Map();

let categoriaSeleccionadaId = "";
let nivelSeleccionadoId = "";

// Estado local de Paginación
let paginaActual = 1;
const productosPorPagina = 20; // Cambia este valor a 20 cuando pases a producción
let productosFiltrados = [];  // Guardará la lista filtrada completa

// js/index-js.js

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Cargar la plantilla HTML del Header y esperar a que termine de inyectarse en el DOM
  await cargarHeader();

  // 2. Escuchar el evento personalizado de actualización de carrito
  window.addEventListener('carritoActualizado', actualizarBadgeCarrito);
  actualizarBadgeCarrito();

  await actualizarBadgePedidosCliente();

  // 3. Inicializar eventos de listeners del Header y del Modal
  inicializarEventosFiltro();
  await inicializarModalDetalle();

  // 4. Leer primero los parámetros de la URL
  procesarParametrosURL();

  // 5. Cargar categorías y niveles desde Firestore
  await cargarCategorias();
  await cargarNiveles();

  // 6. Actualizar explícitamente el texto de los botones del Header
  sincronizarFiltrosConUI();

  // 7. Cargar y filtrar productos
  await cargarProductosActivos();
});

//Sincroniza los textos de los Dropdowns y campos del Header 
//con los valores actuales de los filtros (leídos de la URL o estado)
function sincronizarFiltrosConUI() {
  // 1. Sincronizar Categoría en el Header
  if (categoriaSeleccionadaId && categoriasMap.has(categoriaSeleccionadaId)) {
    const dropCat = document.getElementById('dropCategorias');
    const catNombre = categoriasMap.get(categoriaSeleccionadaId);
    if (dropCat) {
      dropCat.innerHTML = `${catNombre} <i class="fas fa-chevron-down small ml-1"></i>`;
    }

    // Marcar item como activo
    document.querySelectorAll('#menuCategorias .dropdown-item').forEach(item => {
      if (item.dataset.value === categoriaSeleccionadaId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  // 2. Sincronizar Nivel en el Header
  if (nivelSeleccionadoId && nivelesMap.has(nivelSeleccionadoId)) {
    const dropNiv = document.getElementById('dropNiveles');
    const nivelObj = nivelesMap.get(nivelSeleccionadoId);
    const nivNombre = nivelObj ? nivelObj.nombre : 'Niveles';
    if (dropNiv) {
      dropNiv.innerHTML = `${nivNombre} <i class="fas fa-chevron-down small ml-1"></i>`;
    }

    // Marcar item como activo
    document.querySelectorAll('#menuNiveles .dropdown-item').forEach(item => {
      if (item.dataset.value === nivelSeleccionadoId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  // 3. Sincronizar visibilidad del botón "Limpiar Filtros"
  actualizarVisibilidadBotonLimpiar();
}

function procesarParametrosURL() {
  const urlParams = new URLSearchParams(window.location.search);

  const paramBuscar = urlParams.get('buscar');
  const paramCategoria = urlParams.get('categoria');
  const paramNivel = urlParams.get('nivel');
  const paramMin = urlParams.get('pMin');
  const paramMax = urlParams.get('pMax');

  if (paramBuscar) {
    const inputNombre = document.getElementById('filtroNombre');
    if (inputNombre) inputNombre.value = paramBuscar;
  }

  if (paramCategoria) {
    categoriaSeleccionadaId = paramCategoria;
  }

  if (paramNivel) {
    nivelSeleccionadoId = paramNivel;
  }

  // 2: Manejo de estado habilitado/deshabilitado del input max
  const inputMin = document.getElementById('filtroPrecioMin');
  const inputMax = document.getElementById('filtroPrecioMax');

  if (paramMin) {
    if (inputMin) inputMin.value = paramMin;
    if (inputMax) inputMax.disabled = false;
  }

  if (paramMax) {
    if (inputMax) {
      inputMax.disabled = false;
      inputMax.value = paramMax;
    }
  }
}

//Actualiza el indicador visual con el conteo total del carrito
export function actualizarBadgeCarrito() {
  // ID corregido para coincidir con header.html ("carritoBadge")
  const badge = document.getElementById('carritoBadge'); 
  if (badge) {
    const total = obtenerTotalItemsCarrito();
    badge.textContent = total;
  }
}

//Carga la plantilla HTML del Header dinámicamente
async function cargarHeader() {
  try {
    const response = await fetch('header.html');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const html = await response.text();
    const headerContainer = document.getElementById('header-container');
    if (headerContainer) {
      headerContainer.innerHTML = html;
    }


    //Inyección dinámica del favicon en el <head> de la página
    let favicon = document.querySelector("link[rel*='icon']");
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.type = 'image/png';
    favicon.href = 'img/logoTienda.png';
    
  } catch (error) {
    console.error('Error al cargar el header:', error);
  }
}

//Carga categorías activas y genera las opciones dentro del Dropdown
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

      // Si la categoría coincide con la seleccionada vía URL, marcarla como activa
      if (categoriaSeleccionadaId && docSnap.id === categoriaSeleccionadaId) {
        item.classList.add('active');
      }

      menuCat.appendChild(item);
    });

    //Actualización visual del dropdown en el header
    if (categoriaSeleccionadaId && categoriasMap.has(categoriaSeleccionadaId)) {
      const dropCat = document.getElementById('dropCategorias');
      if (dropCat) {
        dropCat.innerHTML = `${categoriasMap.get(categoriaSeleccionadaId)} <i class="fas fa-chevron-down small ml-1"></i>`;
      }
    }

  } catch (error) {
    console.error("Error al cargar Categorías:", error);
  }
}


// Carga niveles activos, los ordena de menor a mayor y genera las opciones en el Dropdown
// Carga niveles activos, los ordena de menor a mayor por 'nivelDificultad' y genera las opciones en el Dropdown
async function cargarNiveles() {
  const menuNiv = document.getElementById('menuNiveles');
  if (!menuNiv) return;

  try {
    const q = query(collection(db, 'Nivel'), where('status', '==', 1));
    const querySnapshot = await getDocs(q);

    // 1. Extraer los datos a un arreglo temporal
    const listaNiveles = [];
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      
      // Guardar en el Map de estado local
      nivelesMap.set(docSnap.id, { 
        nombre: data.nombreNivel, 
        color: data.color,
        nivelDificultad: data.nivelDificultad
      });

      listaNiveles.push({
        id: docSnap.id,
        nombre: data.nombreNivel,
        color: data.color,
        nivelDificultad: Number(data.nivelDificultad) || 0
      });
    });

    // 2. Ordenar directamente de menor a mayor usando nivelDificultad (1 a 10)
    listaNiveles.sort((a, b) => a.nivelDificultad - b.nivelDificultad);

    // 3. Renderizar las opciones ordenadas en el HTML
    listaNiveles.forEach(nivel => {
      const item = document.createElement('a');
      item.className = 'dropdown-item item-nivel';
      item.href = '#';
      item.dataset.value = nivel.id;
      item.textContent = nivel.nombre;

      // Si el nivel coincide con el seleccionado vía URL, marcarlo como activo
      if (nivelSeleccionadoId && nivel.id === nivelSeleccionadoId) {
        item.classList.add('active');
      }

      menuNiv.appendChild(item);
    });

    // Actualización visual del dropdown en el header si hay uno seleccionado
    if (nivelSeleccionadoId && nivelesMap.has(nivelSeleccionadoId)) {
      const dropNiv = document.getElementById('dropNiveles');
      if (dropNiv) {
        dropNiv.innerHTML = `${nivelesMap.get(nivelSeleccionadoId).nombre} <i class="fas fa-chevron-down small ml-1"></i>`;
      }
    }

  } catch (error) {
    console.error("Error al cargar Niveles:", error);
  }
}

//Consulta en Firestore los productos con status == 1
async function cargarProductosActivos() {
  const container = document.getElementById('productosContainer');

  try {
    const q = query(collection(db, 'Producto'), where('status', '==', 1));
    const querySnapshot = await getDocs(q);

    productosLista = querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    aplicarFiltros();
  } catch (error) {
    console.error("Error al cargar productos:", error);
    if (container) {
      container.innerHTML = `
        <div class="col-12 text-center text-danger my-5">
          <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
          <p>Error al obtener el catálogo de productos.</p>
        </div>`;
    }
  }
}

//Controla la visibilidad del botón 'Limpiar filtros'
function actualizarVisibilidadBotonLimpiar() {
  const btnLimpiar = document.getElementById('btnLimpiarFiltros');
  const nombreInput = document.getElementById('filtroNombre');
  const minInput = document.getElementById('filtroPrecioMin');
  const maxInput = document.getElementById('filtroPrecioMax');

  const tieneNombre = nombreInput && nombreInput.value.trim() !== '';
  const tieneCategoria = categoriaSeleccionadaId !== '';
  const tieneNivel = nivelSeleccionadoId !== '';
  const tienePrecio = (minInput && minInput.value !== '') || (maxInput && maxInput.value !== '');

  if (btnLimpiar) {
    if (tieneNombre || tieneCategoria || tieneNivel || tienePrecio) {
      btnLimpiar.classList.remove('d-none');
    } else {
      btnLimpiar.classList.add('d-none');
    }
  }
}

//Aplica los filtros cruzados sobre los productos
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function aplicarFiltros() {
  actualizarVisibilidadBotonLimpiar();

  const nombreInput = document.getElementById('filtroNombre');
  const nombreQuery = nombreInput ? normalizarTexto(nombreInput.value) : '';

  const minInput = document.getElementById('filtroPrecioMin');
  const maxInput = document.getElementById('filtroPrecioMax');

  const valMin = minInput && minInput.value !== '' ? parseFloat(minInput.value) : null;
  const valMax = maxInput && maxInput.value !== '' ? parseFloat(maxInput.value) : null;

  // 1. Guardamos el resultado en la variable global "productosFiltrados"
  productosFiltrados = productosLista.filter(p => {
    const nombreProductoNorm = p.nombreProducto ? normalizarTexto(p.nombreProducto) : '';
    const coincideNombre = nombreQuery ? nombreProductoNorm.includes(nombreQuery) : true;
    
    const coincideCategoria = categoriaSeleccionadaId ? p.idCategoria === categoriaSeleccionadaId : true;
    const coincideNivel = nivelSeleccionadoId ? p.idNivel === nivelSeleccionadoId : true;

    const precio = parseFloat(p.precio) || 0;
    let coincidePrecio = true;

    if (valMin !== null && valMax === null) {
      coincidePrecio = precio >= valMin;
    } else if (valMin !== null && valMax !== null) {
      coincidePrecio = precio >= valMin && precio <= valMax;
    } else if (valMin === null && valMax !== null) {
      coincidePrecio = precio <= valMax;
    }

    return coincideNombre && coincideCategoria && coincideNivel && coincidePrecio;
  });

  // 2. Reiniciamos la página
  paginaActual = 1;

  // 3. Llamamos a la función con paginación
  renderizarProductosPaginados();
}
//Renderiza las tarjetas de productos en el grid
function renderizarProductos(productos) {
  const container = document.getElementById('productosContainer');
  if (!container) return;

  container.innerHTML = '';

  if (productos.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center text-muted my-5">
        <i class="fas fa-box-open fa-3x mb-3"></i>
        <h5>No se encontraron productos que coincidan con los criterios seleccionados.</h5>
      </div>`;
    return;
  }

  productos.forEach(p => {
    const catNombre = categoriasMap.get(p.idCategoria) || 'Sin Categoría';
    const nivelData = nivelesMap.get(p.idNivel) || { nombre: 'N/A', color: '6c757d' };

    const hexColor = nivelData.color ? (nivelData.color.startsWith('#') ? nivelData.color : `#${nivelData.color}`) : '#6c757d';

    const cardHTML = `
      <div class="col-6 col-md-4 col-lg-3 mb-3 px-1 px-sm-2">
        <div class="card card-product h-100 shadow-sm">
          <div class="product-img-wrapper">
            <img src="${p.imagenUrl || 'https://via.placeholder.com/300x200?text=Sin+Imagen'}" 
                 alt="${p.nombreProducto}"
                 onerror="this.onerror=null; this.src='https://via.placeholder.com/300x200?text=Sin+Imagen';">
          </div>

          <div class="card-body d-flex flex-column justify-content-between p-3">
            <div>
              <h5 class="card-title text-truncate font-weight-bold mb-1" title="${p.nombreProducto}">
                ${p.nombreProducto}
              </h5>
              <p class="precio-producto mb-2">
                $${Number(p.precio).toFixed(2)}
              </p>
            </div>

            <div>
              <div class="d-flex justify-content-between align-items-center mb-3">
                <span class="categoria-texto text-truncate mr-2" style="max-width: 55%;" title="${catNombre}">
                  <i class="fas fa-tag mr-1 text-muted"></i>${catNombre}
                </span>
                <span class="badge badge-nivel px-2 py-1 text-white" style="background-color: ${hexColor};">
                  ${nivelData.nombre}
                </span>
              </div>

              <button class="btn btn-block btn-agregar-carrito" 
                data-id="${p.id}"
                ${p.cantidad <= 0 ? 'disabled' : ''}>
                <i class="fas fa-cart-plus mr-1"></i>
                ${p.cantidad > 0 ? 'Añadir al carrito' : 'Agotado'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', cardHTML);
  });
}

//Registra los escuchadores de eventos para los filtros
function inicializarEventosFiltro() {
  document.getElementById('filtroNombre')?.addEventListener('input', aplicarFiltros);

  document.getElementById('menuCategorias')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('dropdown-item')) {
      e.preventDefault();
      categoriaSeleccionadaId = e.target.dataset.value;

      const catNombre = categoriaSeleccionadaId ? e.target.textContent : 'Categorías';
      document.getElementById('dropCategorias').innerHTML = `${catNombre} <i class="fas fa-chevron-down small ml-1"></i>`;

      document.querySelectorAll('#menuCategorias .dropdown-item').forEach(el => el.classList.remove('active'));
      e.target.classList.add('active');

      aplicarFiltros();
    }
  });

  document.getElementById('menuNiveles')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('dropdown-item')) {
      e.preventDefault();
      nivelSeleccionadoId = e.target.dataset.value;

      const nivNombre = nivelSeleccionadoId ? e.target.textContent : 'Niveles';
      document.getElementById('dropNiveles').innerHTML = `${nivNombre} <i class="fas fa-chevron-down small ml-1"></i>`;

      document.querySelectorAll('#menuNiveles .dropdown-item').forEach(el => el.classList.remove('active'));
      e.target.classList.add('active');

      aplicarFiltros();
    }
  });

  const inputMin = document.getElementById('filtroPrecioMin');
  const inputMax = document.getElementById('filtroPrecioMax');

  inputMin?.addEventListener('input', () => {
    if (inputMin.value.trim() !== '') {
      inputMax.disabled = false;
    } else {
      inputMax.value = '';
      inputMax.disabled = true;
    }
    actualizarVisibilidadBotonLimpiar();
  });

  inputMax?.addEventListener('input', actualizarVisibilidadBotonLimpiar);

  document.getElementById('btnAplicarPrecio')?.addEventListener('click', (e) => {
    e.preventDefault();

    const valMin = inputMin && inputMin.value !== '' ? parseFloat(inputMin.value) : null;
    const valMax = inputMax && inputMax.value !== '' ? parseFloat(inputMax.value) : null;

    if (valMin !== null && valMin < 0) {
      mostrarToast('El precio mínimo no puede ser negativo.', 'warning');
      return;
    }

    if (valMin !== null && valMax !== null && valMax > 0 && valMax <= valMin) {
      mostrarToast('El precio máximo debe ser mayor al precio mínimo.', 'warning');
      return;
    }

    aplicarFiltros();
  });

  document.getElementById('btnLimpiarFiltros')?.addEventListener('click', () => {
    const inputNombre = document.getElementById('filtroNombre');

    if (inputNombre) inputNombre.value = '';
    if (inputMin) inputMin.value = '';
    if (inputMax) {
      inputMax.value = '';
      inputMax.disabled = true;
    }

    categoriaSeleccionadaId = "";
    nivelSeleccionadoId = "";

    document.getElementById('dropCategorias').innerHTML = `Categorías <i class="fas fa-chevron-down small ml-1"></i>`;
    document.getElementById('dropNiveles').innerHTML = `Niveles <i class="fas fa-chevron-down small ml-1"></i>`;

    document.querySelectorAll('#menuCategorias .dropdown-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#menuNiveles .dropdown-item').forEach(el => el.classList.remove('active'));

    aplicarFiltros();
  });

  document.getElementById('productosContainer')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-agregar-carrito');
    if (btn) {
      const idProducto = btn.dataset.id;
      const producto = productosLista.find(p => p.id === idProducto);

      if (producto) {
        const catNombre = categoriasMap.get(producto.idCategoria) || 'Sin Categoría';
        const nivelData = nivelesMap.get(producto.idNivel) || { nombre: 'N/A', color: '6c757d' };

        abrirModalDetalle(producto, catNombre, nivelData);
      }
    }
  });


  document.getElementById('paginacionContainer')?.addEventListener('click', (e) => {
          const link = e.target.closest('.page-link');
          if (!link) return;

          e.preventDefault();
          
          const nuevaPagina = parseInt(link.dataset.page);
          const totalPaginas = Math.ceil(productosFiltrados.length / productosPorPagina);

          // Validamos que esté dentro de los rangos válidos
          if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas && nuevaPagina !== paginaActual) {
              paginaActual = nuevaPagina;
              renderizarProductosPaginados();

              // Desplazar suavemente hacia arriba para que el usuario vea los nuevos productos
              window.scrollTo({ top: 0, behavior: 'smooth' });
          }
      });  
}



// Corta el arreglo filtrado según la página actual y llama a renderizar
function renderizarProductosPaginados() {
    const inicio = (paginaActual - 1) * productosPorPagina;
    const fin = inicio + productosPorPagina;
    
    // Extraemos solo los productos que corresponden a esta página
    const productosPagina = productosFiltrados.slice(inicio, fin);

    // Renderizamos las tarjetas de esa página
    renderizarProductos(productosPagina);

    // Dibujamos los botones de la paginación abajo
    renderizarControlesPaginacion();
}

// Genera los botones estilo Google/Bootstrap (Anterior, 1, 2, 3..., Siguiente)
// Genera los botones estilo Google/Bootstrap limitados a un máximo de 10 visibles
function renderizarControlesPaginacion() {
  const navContainer = document.getElementById('paginacionContainer');
  if (!navContainer) return;

  navContainer.innerHTML = '';

  const totalPaginas = Math.ceil(productosFiltrados.length / productosPorPagina);

  // Si hay 1 o menos páginas, no mostramos la barra de paginación
  if (totalPaginas <= 1) return;

  // Límite de botones numéricos a mostrar en pantalla
  const maxPaginasVisibles = 10;

  // Definimos el rango (inicio y fin) de forma dinámica
  let paginaInicio = Math.max(1, paginaActual - Math.floor(maxPaginasVisibles / 2));
  let paginaFin = paginaInicio + maxPaginasVisibles - 1;

  // Ajuste si el final se pasa del total de páginas disponibles
  if (paginaFin > totalPaginas) {
    paginaFin = totalPaginas;
    paginaInicio = Math.max(1, paginaFin - maxPaginasVisibles + 1);
  }

  let html = '';

  // 1. Botón "Anterior" (&laquo;)
  html += `
    <li class="page-item ${paginaActual === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${paginaActual - 1}" aria-label="Anterior">
        <span aria-hidden="true">&laquo;</span>
      </a>
    </li>
  `;

  // 2. Si la primera página visible no es la 1, opcionalmente agregamos la página 1 y puntos suspensivos
  if (paginaInicio > 1) {
    html += `
      <li class="page-item">
        <a class="page-link" href="#" data-page="1">1</a>
      </li>
    `;
    if (paginaInicio > 2) {
      html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
  }

  // 3. Botones numéricos dentro del rango calculado (máximo 10)
  for (let i = paginaInicio; i <= paginaFin; i++) {
    html += `
      <li class="page-item ${i === paginaActual ? 'active' : ''}">
        <a class="page-link" href="#" data-page="${i}">${i}</a>
      </li>
    `;
  }

  // 4. Si la última página visible no es la última total, agregamos puntos suspensivos y la última página
  if (paginaFin < totalPaginas) {
    if (paginaFin < totalPaginas - 1) {
      html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
    html += `
      <li class="page-item">
        <a class="page-link" href="#" data-page="${totalPaginas}">${totalPaginas}</a>
      </li>
    `;
  }

  // 5. Botón "Siguiente" (&raquo;)
  html += `
    <li class="page-item ${paginaActual === totalPaginas ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${paginaActual + 1}" aria-label="Siguiente">
        <span aria-hidden="true">&raquo;</span>
      </a>
    </li>
  `;

  navContainer.innerHTML = html;
}