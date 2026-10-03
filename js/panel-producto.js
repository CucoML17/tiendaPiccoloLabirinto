// js/panel-producto.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { mostrarConfirmacion } from './modal-confirm.js';
import { mostrarToast } from './toast.js';
import { mostrarModalRestock } from './modal-restock.js'; // <--- MÓDULO INTEGRADO

// Estados locales en memoria
let productosLocales = [];
let categoriasMap = new Map(); 
let nivelesMap = new Map();   


let paginaActual = 1;
const productosPorPagina = 20; // (Cámbialo a 20 en producción)
let productosFiltradosGuardados = [];

// normalizar texto (Quitar acentos/tildes y pasar a minúsculas)
function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function escapeHTML(str) {
    return str ? String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    ) : '';
}

document.addEventListener('DOMContentLoaded', () => {
    // Referencias del DOM
    const tablaBody = document.getElementById('tablaProductosBody');
    const inputNombre = document.getElementById('filtroNombre');
    const selectCategoria = document.getElementById('filtroCategoria');
    const selectNivel = document.getElementById('filtroNivel');
    const inputPrecioMin = document.getElementById('filtroPrecioMin');
    const inputPrecioMax = document.getElementById('filtroPrecioMax');
    const btnLimpiar = document.getElementById('btnLimpiarFiltros');

    const contenedorPaginacion = document.getElementById('contenedorPaginacion');

    	// Colapsar automáticamente la barra de filtros solo en smartphones
    if (window.innerWidth < 576) {
        const collapseFiltros = document.getElementById('collapseFiltros');
        if (collapseFiltros) {
            collapseFiltros.classList.remove('show');
            
            const btnToggle = document.querySelector('[data-target="#collapseFiltros"] i');
            if (btnToggle) {
                btnToggle.className = 'fas fa-chevron-down';
            }
        }
    }

    //Inicializar estado de precio máximo bloqueado
    if (inputPrecioMax) inputPrecioMax.disabled = true;

    //1. Carga de datos (categorías, nuiveles y productos)
    async function inicializarPanel() {
        try {
            await Promise.all([cargarCategorias(), cargarNiveles()]);
            await cargarProductos();
        } catch (error) {
            console.error("Error al inicializar el panel:", error);
            mostrarToast("Error crítico al cargar la información inicial.", "danger");
        }
    }

    async function cargarCategorias() {
        const q = query(collection(db, 'Categoria'), where("status", "==", 1));
        const snapshot = await getDocs(q);
        
        selectCategoria.innerHTML = '<option value="">Todas las categorías</option>';
        categoriasMap.clear();

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            categoriasMap.set(docSnap.id, data);
            
            const option = document.createElement('option');
            option.value = docSnap.id;
            option.textContent = data.nombreCategoria;
            selectCategoria.appendChild(option);
        });
    }

    async function cargarNiveles() {
        const q = query(collection(db, 'Nivel'), where("status", "==", 1));
        const snapshot = await getDocs(q);
        
        selectNivel.innerHTML = '<option value="">Todos los niveles</option>';
        nivelesMap.clear();

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            nivelesMap.set(docSnap.id, data);
            
            const option = document.createElement('option');
            option.value = docSnap.id;
            option.textContent = data.nombreNivel;
            selectNivel.appendChild(option);
        });
    }

    async function cargarProductos() {
        try {
            const q = query(collection(db, 'Producto'), where("status", "==", 1));
            const snapshot = await getDocs(q);

            productosLocales = [];
            snapshot.forEach(docSnap => {
                productosLocales.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });
            });

            aplicarFiltros();
        } catch (error) {
            console.error("Error al obtener los productos:", error);
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-danger py-3">
                        <i class="fas fa-exclamation-triangle mr-1"></i> Error al cargar el catálogo de productos.
                    </td>
                </tr>
            `;
        }
    }

    // SVG  integrado por si el producto no tiene imagen o la URL de Cloudinary llega a fallar
    const NO_IMAGE_SVG = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23a0aec0' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";

    function renderizarTabla(lista) {
        if (!tablaBody) return;

        if (lista.length === 0) {
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-3">
                        No se encontraron productos registrados o coincidentes con la búsqueda.
                    </td>
                </tr>
            `;
            return;
        }

        const inicio = (paginaActual - 1) * productosPorPagina;
        const fin = inicio + productosPorPagina;
        const listaPaginada = lista.slice(inicio, fin);        

        tablaBody.innerHTML = listaPaginada.map(prod => {
            // Relación Categoría
            const catObj = categoriasMap.get(prod.idCategoria);
            const nombreCategoria = catObj ? catObj.nombreCategoria : 'Sin Categoría';

            //  Relación Nivel y Formatear Color HEX
            const nivObj = nivelesMap.get(prod.idNivel);
            const nombreNivel = nivObj ? nivObj.nombreNivel : 'N/A';
            const colorHex = (nivObj && nivObj.color) ? `#${nivObj.color.replace('#', '')}` : '#6c757d';

            // Lectura de imagen de Cloudinary
            const urlFirestore = prod.imagenUrl || prod.imageUrl;
            const imgUrl = (urlFirestore && urlFirestore.trim() !== '') ? urlFirestore : NO_IMAGE_SVG;

            return `
                <tr>
                    <!-- Columna 1: Imagen, y en móvil Nombre (Bold) y Precio -->
                    <td class="align-middle text-center">
                        <div class="thumb-producto-container">
                            <img 
                                src="${escapeHTML(imgUrl)}" 
                                alt="${escapeHTML(prod.nombreProducto)}" 
                                class="thumb-producto" 
                                onerror="this.onerror=null; this.src='${NO_IMAGE_SVG}';"
                            >
                        </div>
                        <!-- En móvil: Nombre en BOLD y Precio -->
                        <div class="d-sm-none mt-1">
                            <strong class="d-block text-dark small font-weight-bold leading-tight">${escapeHTML(prod.nombreProducto)}</strong>
                            <span class="badge badge-success font-weight-bold" style="font-size: 0.75rem;">
                                $${Number(prod.precio || 0).toFixed(2)}
                            </span>
                        </div>
                    </td>

                    <!-- Columna 2: Nombre (Escritorio / Tablet) -->
                    <td class="align-middle font-weight-bold d-none d-sm-table-cell">${escapeHTML(prod.nombreProducto)}</td>

                    <!-- Columna 3: Descripción (Con ancho limitado en móvil) -->
                    <td class="align-middle col-descripcion-movil">${escapeHTML(prod.descripcion)}</td>
                    
                    <!-- Columna 4: Categoría y Nivel (En móvil: Nivel sin icono y BOLD) -->
                    <td class="align-middle text-center font-weight-bold">
                        <span class="d-block">${escapeHTML(nombreCategoria)}</span>
                        <span class="d-sm-none d-block small mt-1 font-weight-bold" style="color: ${colorHex};">
                            ${escapeHTML(nombreNivel)}
                        </span>
                    </td>
                    
                    <!-- Columna 5: Nivel (Escritorio / Tablet) -->
                    <td class="align-middle text-center font-weight-bold d-none d-sm-table-cell" style="color: ${colorHex};">
                        ${escapeHTML(nombreNivel)}
                    </td>
                    
                    <!-- Columna 6: Precio (Escritorio / Tablet) -->
                    <td class="align-middle text-center font-weight-bold d-none d-sm-table-cell">$${Number(prod.precio || 0).toFixed(2)}</td>

                    <!-- Columna 7: Cantidad / Stock -->
                    <td class="align-middle text-center font-weight-bold" style="color: #2e7d32 !important; font-size:16px;">
                        ${Number(prod.cantidad || 0)}
                    </td>

                    <!-- Columna 8: Acciones (Disposición en cuadrícula compacta 2-1 en móviles) -->
                    <td class="text-center align-middle">
                        <div class="acciones-grid-movil">
                            <button class="btn btn-warning btn-circle-sm text-white btn-editar" title="Editar Producto" data-id="${prod.id}">
                                <i class="fas fa-pen"></i>
                            </button>
                            <button class="btn btn-teal btn-circle-sm btn-restock" title="Re-stock / Añadir Existencias" data-id="${prod.id}">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button class="btn btn-danger btn-circle-sm btn-eliminar" title="Eliminar Producto" data-id="${prod.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        renderizarControlesPaginacion(lista.length);
    }


    function renderizarControlesPaginacion(totalItems) {
        if (!contenedorPaginacion) return;

        const totalPaginas = Math.ceil(totalItems / productosPorPagina);
        if (totalPaginas <= 1) {
            contenedorPaginacion.innerHTML = '';
            return;
        }

        let htmlNav = '';

        // Botón Anterior
        htmlNav += `
            <li class="page-item ${paginaActual === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${paginaActual - 1}" aria-label="Anterior">
                    <span aria-hidden="true">&laquo;</span>
                </a>
            </li>
        `;

        // Botones de Páginas
        for (let i = 1; i <= totalPaginas; i++) {
            htmlNav += `
                <li class="page-item ${i === paginaActual ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }

        // Botón Siguiente
        htmlNav += `
            <li class="page-item ${paginaActual === totalPaginas ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${paginaActual + 1}" aria-label="Siguiente">
                    <span aria-hidden="true">&raquo;</span>
                </a>
            </li>
        `;

        contenedorPaginacion.innerHTML = htmlNav;
    }

    function cambiarPagina(nuevaPagina) {
        const totalPaginas = Math.ceil(productosFiltradosGuardados.length / productosPorPagina);
        if (nuevaPagina < 1 || nuevaPagina > totalPaginas) return;

        paginaActual = nuevaPagina;
        renderizarTabla(productosFiltradosGuardados);
    }

    // Delegación de clic para la paginación
    if (contenedorPaginacion) {
        contenedorPaginacion.addEventListener('click', (e) => {
            e.preventDefault();
            const link = e.target.closest('.page-link');
            if (!link) return;

            const targetPage = parseInt(link.getAttribute('data-page'), 10);
            if (!isNaN(targetPage)) {
                cambiarPagina(targetPage);
            }
        });
    }    

    //3. Filtradp cominado con AND
    function aplicarFiltros() {
        const busquedaNombre = normalizarTexto(inputNombre ? inputNombre.value.trim() : '');
        const catSeleccionada = selectCategoria ? selectCategoria.value : '';
        const nivSeleccionado = selectNivel ? selectNivel.value : '';

        const valMin = inputPrecioMin && inputPrecioMin.value !== '' ? parseFloat(inputPrecioMin.value) : null;
        const valMax = inputPrecioMax && inputPrecioMax.value !== '' ? parseFloat(inputPrecioMax.value) : null;

        // Validación de coherencia de rango de precios
        if (valMin !== null && valMax !== null && valMax < valMin) {
            return; // Detener filtrado si el rango es inválido
        }

        productosFiltradosGuardados = productosLocales.filter(prod => {
            // Filtro Nombre
            if (busquedaNombre && !normalizarTexto(prod.nombreProducto).includes(busquedaNombre)) {
                return false;
            }

            // Filtro Categoría
            if (catSeleccionada && prod.idCategoria !== catSeleccionada) {
                return false;
            }

            // Filtro Nivel
            if (nivSeleccionado && prod.idNivel !== nivSeleccionado) {
                return false;
            }

            // Filtro Rango de Precio
            const precio = parseFloat(prod.precio || 0);
            if (valMin !== null && valMax === null) {
                if (precio !== valMin) return false;
            } else if (valMin !== null && valMax !== null) {
                if (precio < valMin || precio > valMax) return false;
            }

            return true;
        });

        paginaActual = 1; // Reinicia a la página 1 cada vez que se aplica un filtro
        renderizarTabla(productosFiltradosGuardados);
    }

    //4. Control de ventos pare precio y filtros
    if (inputPrecioMin) {
        inputPrecioMin.addEventListener('input', () => {
            const minVal = parseFloat(inputPrecioMin.value);

            if (!isNaN(minVal) && minVal > 0) {
                inputPrecioMax.disabled = false;
            } else {
                inputPrecioMax.disabled = true;
                inputPrecioMax.value = '';
            }
            aplicarFiltros();
        });
    }

    if (inputPrecioMax) {
        inputPrecioMax.addEventListener('input', aplicarFiltros);
    }

    if (inputNombre) inputNombre.addEventListener('input', aplicarFiltros);
    if (selectCategoria) selectCategoria.addEventListener('change', aplicarFiltros);
    if (selectNivel) selectNivel.addEventListener('change', aplicarFiltros);

    // Botón Limpiar Filtros
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            if (inputNombre) inputNombre.value = '';
            if (selectCategoria) selectCategoria.value = '';
            if (selectNivel) selectNivel.value = '';
            if (inputPrecioMin) inputPrecioMin.value = '';
            if (inputPrecioMax) {
                inputPrecioMax.value = '';
                inputPrecioMax.disabled = true;
            }
            aplicarFiltros();
        });
    }

    //5. Acción de re-stock
    async function reabastecerProducto(productoId) {
        const prodObj = productosLocales.find(p => p.id === productoId);
        if (!prodObj) return;

        // Mostrar modal interactivo
        const cantidadASumar = await mostrarModalRestock({
            nombreProducto: prodObj.nombreProducto,
            stockActual: prodObj.cantidad || 0
        });

        if (!cantidadASumar) return; // Cancelado por el usuario

        const nuevoStock = (parseInt(prodObj.cantidad, 10) || 0) + cantidadASumar;

        try {
            const docRef = doc(db, 'Producto', productoId);
            await updateDoc(docRef, { cantidad: nuevoStock });

            // Actualizar arreglo local en memoria
            prodObj.cantidad = nuevoStock;

            // Re-renderizar la vista manteniendo filtros vigentes
            aplicarFiltros();

            mostrarToast(`Se agregaron ${cantidadASumar} piezas a "${prodObj.nombreProducto}". Nuevo stock: ${nuevoStock}`, "success");

        } catch (error) {
            console.error("Error al reabastecer producto:", error);
            mostrarToast("No se pudo actualizar el stock en la base de datos.", "danger");
        }
    }

    //6. Eliminar
    async function eliminarProducto(productoId, nombre) {
        const confirmado = await mostrarConfirmacion({
            titulo: 'Eliminar Producto',
            mensaje: `¿Estás seguro de desactivar el producto "${nombre}"?`,
            btnAceptarText: 'Sí, eliminar',
            btnCancelarText: 'Cancelar',
            btnAceptarClass: 'btn-danger'
        });

        if (!confirmado) return;

        try {
            const docRef = doc(db, 'Producto', productoId);
            await updateDoc(docRef, { status: 0 });

            productosLocales = productosLocales.filter(p => p.id !== productoId);
            aplicarFiltros();
            mostrarToast(`Producto "${nombre}" eliminado con éxito.`, "success");

        } catch (error) {
            console.error("Error al desactivar el producto:", error);
            mostrarToast("No se pudo desactivar el producto.", "danger");
        }
    }

    //7. Delegación de eventos en la tabla
    if (tablaBody) {
        tablaBody.addEventListener('click', (e) => {
            const btnEditar = e.target.closest('.btn-editar');
            const btnRestock = e.target.closest('.btn-restock');
            const btnEliminar = e.target.closest('.btn-eliminar');

            if (btnEditar) {
                const prodId = btnEditar.getAttribute('data-id');
                if (prodId) {
                    sessionStorage.setItem('editarProductoId', prodId);
                    window.location.href = 'formProducto.html';
                }
            }

            if (btnRestock) {
                const prodId = btnRestock.getAttribute('data-id');
                if (prodId) {
                    reabastecerProducto(prodId);
                }
            }

            if (btnEliminar) {
                const prodId = btnEliminar.getAttribute('data-id');
                const prodObj = productosLocales.find(p => p.id === prodId);
                const nombreProd = prodObj ? prodObj.nombreProducto : '';

                if (prodId) {
                    eliminarProducto(prodId, nombreProd);
                }
            }
        });
    }

    // Inicialización del flujo
    inicializarPanel();
});