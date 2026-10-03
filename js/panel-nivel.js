// js/panel-nivel.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { mostrarConfirmacion } from './modal-confirm.js'; // Importamos el modal global

let nivelesLocales = [];

document.addEventListener('DOMContentLoaded', () => {
    const tablaBody = document.querySelector('table tbody');
    const inputFiltro = document.getElementById('filtroNombre');
    const btnLimpiar = document.querySelector('form button[type="button"]');

    // Colapsar automáticamente la barra de filtros solo en smartphones (< 576px)
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

    // Función auxiliar para ordenar de menor a mayor por nivelDificultad
    function ordenarPorDificultad(lista) {
        return lista.sort((a, b) => {
            const difA = Number(a.nivelDificultad) || 0;
            const difB = Number(b.nivelDificultad) || 0;
            return difA - difB;
        });
    }

    // 1. Obtener registros de Firestore (status == 1)
    async function cargarNiveles() {
        try {
            const q = query(collection(db, 'Nivel'), where("status", "==", 1));
            const querySnapshot = await getDocs(q);

            nivelesLocales = [];
            querySnapshot.forEach((docSnap) => {
                nivelesLocales.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });
            });

            // Ordenamiento por grado de dificultad (1 a 10)
            ordenarPorDificultad(nivelesLocales);

            renderizarTabla(nivelesLocales);
        } catch (error) {
            console.error("Error al obtener los niveles:", error);
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-danger py-3">
                        <i class="fas fa-exclamation-triangle mr-1"></i> Error al cargar los niveles.
                    </td>
                </tr>
            `;
        }
    }

    // 2. Renderizar filas en la tabla
    function renderizarTabla(lista) {
        if (lista.length === 0) {
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted py-3">
                        No se encontraron niveles registrados.
                    </td>
                </tr>
            `;
            return;
        }

        tablaBody.innerHTML = lista.map(nivel => {
            // Asegurar que el color tenga '#' para la muestra de CSS y texto HTML
            const colorHex = nivel.color ? (nivel.color.startsWith('#') ? nivel.color : `#${nivel.color}`) : '#000000';
            const dificultadVal = nivel.nivelDificultad !== undefined ? nivel.nivelDificultad : '-';

            return `
                <tr>
                    <td class="align-middle font-weight-bold">${escapeHTML(nivel.nombreNivel)}</td>
                    <td class="text-center align-middle">
                        <span class="font-weight-bold text-dark" style="font-size: 1.1rem;">
                            ${dificultadVal}
                        </span>
                    </td>
                    <td class="align-middle">
                        <span class="color-preview-box mr-2" style="background-color: ${colorHex};"></span>
                        <code>${colorHex.toUpperCase()}</code>
                    </td>
                    <td class="text-center align-middle">
                        <div class="d-flex justify-content-center align-items-center">
                            <button class="btn btn-warning btn-circle-sm mx-1 text-white btn-editar" title="Editar Nivel" data-id="${nivel.id}">
                                <i class="fas fa-pen"></i>
                            </button>
                            <button class="btn btn-danger btn-circle-sm mx-1 btn-eliminar" title="Eliminar Nivel" data-id="${nivel.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function escapeHTML(str) {
        return str ? str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        ) : '';
    }

    // 3. Eliminación Lógica (soft delete: status = 0)
    async function eliminarNivel(nivelId, nombre) {
        const confirmado = await mostrarConfirmacion({
            titulo: 'Eliminar Nivel',
            mensaje: `¿Estás seguro de que deseas eliminar el nivel "${nombre}"?`,
            btnAceptarText: 'Sí, eliminar',
            btnCancelarText: 'Cancelar',
            btnAceptarClass: 'btn-danger'
        });

        if (!confirmado) return;

        try {
            const docRef = doc(db, 'Nivel', nivelId);
            await updateDoc(docRef, { status: 0 });

            // Remover del array local
            nivelesLocales = nivelesLocales.filter(n => n.id !== nivelId);

            // Re-aplicar filtro y ordenamiento si hay texto en la búsqueda
            const busqueda = inputFiltro ? normalizarTexto(inputFiltro.value.trim()) : '';
            const filtrados = nivelesLocales.filter(n => 
                normalizarTexto(n.nombreNivel).includes(busqueda)
            );
            
            ordenarPorDificultad(filtrados);
            renderizarTabla(filtrados);

        } catch (error) {
            console.error("Error al desactivar el nivel:", error);
            alert("Ocurrió un error al intentar eliminar el nivel.");
        }
    }

    // Función para remover acentos/tildes y convertir a minúsculas
    function normalizarTexto(texto) {
        if (!texto) return '';
        return texto
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, ""); // Remueve los caracteres de acentuación
    }

    // 4. Delegación de eventos para la tabla (Editar y Eliminar)
    if (tablaBody) {
        tablaBody.addEventListener('click', (e) => {
            const btnEditar = e.target.closest('.btn-editar');
            const btnEliminar = e.target.closest('.btn-eliminar');

            if (btnEditar) {
                const nivelId = btnEditar.getAttribute('data-id');
                if (nivelId) {
                    sessionStorage.setItem('editarNivelId', nivelId);
                    window.location.href = 'formNivel.html';
                }
            }

            if (btnEliminar) {
                const nivelId = btnEliminar.getAttribute('data-id');
                const nivelObj = nivelesLocales.find(n => n.id === nivelId);
                const nombreNivel = nivelObj ? nivelObj.nombreNivel : '';

                if (nivelId) {
                    eliminarNivel(nivelId, nombreNivel);
                }
            }
        });
    }

    // 5. Filtros por nombre (Insensible a acentos y ordenado)
    if (inputFiltro) {
        inputFiltro.addEventListener('input', (e) => {
            const busqueda = normalizarTexto(e.target.value.trim());
            
            const filtrados = nivelesLocales.filter(n => 
                normalizarTexto(n.nombreNivel).includes(busqueda)
            );
            
            ordenarPorDificultad(filtrados);
            renderizarTabla(filtrados);
        });
    }

    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            if (inputFiltro) {
                inputFiltro.value = '';
                ordenarPorDificultad(nivelesLocales);
                renderizarTabla(nivelesLocales);
            }
        });
    }

    // Cargar los niveles al iniciar
    cargarNiveles();
});