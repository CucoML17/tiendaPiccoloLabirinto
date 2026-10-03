// js/panel-categoria.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { mostrarConfirmacion } from './modal-confirm.js'; // Importamos el modal global

let categoriasLocales = [];

//Para normalizar texto (Quitar acentos/tildes y pasar a minúsculas)
function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

document.addEventListener('DOMContentLoaded', () => {
    const tablaBody = document.querySelector('table tbody');
    const inputFiltro = document.getElementById('filtroNombre');
    const btnLimpiar = document.querySelector('form button[type="button"]');


    	//Colapsar automáticamente la barra de filtros solo en smartphones (< 576px)
    if (window.innerWidth < 576) {
        const collapseFiltros = document.getElementById('collapseFiltros');
        if (collapseFiltros) {
            collapseFiltros.classList.remove('show');
            // Opcional: Actualizar el icono de la flecha si es necesario
            const btnToggle = document.querySelector('[data-target="#collapseFiltros"] i');
            if (btnToggle) {
                btnToggle.className = 'fas fa-chevron-down';
            }
        }
    }

    //1. Obtener registros de Firestore
    async function cargarCategorias() {
        try {
            const q = query(collection(db, 'Categoria'), where("status", "==", 1));
            const querySnapshot = await getDocs(q);
            
            categoriasLocales = [];
            querySnapshot.forEach((docSnap) => {
                categoriasLocales.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });
            });

            renderizarTabla(categoriasLocales);
        } catch (error) {
            console.error("Error al obtener las categorías:", error);
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="2" class="text-center text-danger py-3">
                        <i class="fas fa-exclamation-triangle mr-1"></i> Error al cargar las categorías.
                    </td>
                </tr>
            `;
        }
    }

    // 2. Renderizar filas
    function renderizarTabla(lista) {
        if (lista.length === 0) {
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="2" class="text-center text-muted py-3">
                        No se encontraron categorías registradas.
                    </td>
                </tr>
            `;
            return;
        }

        tablaBody.innerHTML = lista.map(cat => `
             <tr>
                <td class="align-middle font-weight-bold">${escapeHTML(cat.nombreCategoria)}</td>
                <td class="text-center align-middle">
                    <div class="d-flex justify-content-center align-items-center">
                        <button class="btn btn-warning btn-circle-sm mx-1 text-white btn-editar" title="Editar Categoría" data-id="${cat.id}">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn btn-danger btn-circle-sm mx-1 btn-eliminar" title="Eliminar Categoría" data-id="${cat.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    function escapeHTML(str) {
        return str ? str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        ) : '';
    }

    // 3. Eliminación Lógica utilizando el modal global
    async function eliminarCategoria(categoriaId, nombre) {
        //Llamar el modal con los textos que necesitemos
        const confirmado = await mostrarConfirmacion({
            titulo: 'Eliminar Categoría',
            mensaje: `¿Estás seguro de que deseas eliminar la categoría "${nombre}"?`,
            btnAceptarText: 'Sí, eliminar',
            btnCancelarText: 'Cancelar',
            btnAceptarClass: 'btn-danger'
        });

        if (!confirmado) return;

        try {
            const docRef = doc(db, 'Categoria', categoriaId);
            await updateDoc(docRef, { status: 0 });

            //Eliminar del array local y actualizar vista
            categoriasLocales = categoriasLocales.filter(cat => cat.id !== categoriaId);
            
            //Re-evaluar el filtro insensible a acentos tras eliminar
            const busqueda = inputFiltro ? normalizarTexto(inputFiltro.value.trim()) : '';
            const filtradas = categoriasLocales.filter(cat => 
                normalizarTexto(cat.nombreCategoria).includes(busqueda)
            );
            
            renderizarTabla(filtradas);

        } catch (error) {
            console.error("Error al desactivar la categoría:", error);
            alert("Ocurrió un error al intentar eliminar la categoría.");
        }
    }

    //4. Capturar clics en la tabla
    if (tablaBody) {
        tablaBody.addEventListener('click', (e) => {
            const btnEditar = e.target.closest('.btn-editar');
            const btnEliminar = e.target.closest('.btn-eliminar');
            
            if (btnEditar) {
                const categoriaId = btnEditar.getAttribute('data-id');
                if (categoriaId) {
                    sessionStorage.setItem('editarCategoriaId', categoriaId);
                    window.location.href = 'formCategoria.html';
                }
            }

            if (btnEliminar) {
                const categoriaId = btnEliminar.getAttribute('data-id');
                // Busca la categoría en la memoria local para mostrar su nombre en la pregunta
                const categoriaObj = categoriasLocales.find(c => c.id === categoriaId);
                const nombreCat = categoriaObj ? categoriaObj.nombreCategoria : '';
                
                if (categoriaId) {
                    eliminarCategoria(categoriaId, nombreCat);
                }
            }
        });
    }

    //5. Filtros por nombre (Insensible a acentos)
    if (inputFiltro) {
        inputFiltro.addEventListener('input', (e) => {
            const busqueda = normalizarTexto(e.target.value.trim());
            const filtradas = categoriasLocales.filter(cat => 
                normalizarTexto(cat.nombreCategoria).includes(busqueda)
            );
            renderizarTabla(filtradas);
        });
    }

    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            if (inputFiltro) {
                inputFiltro.value = '';
                renderizarTabla(categoriasLocales);
            }
        });
    }

    cargarCategorias();
});