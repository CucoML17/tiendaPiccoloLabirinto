// js/panel-historial.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { mostrarModalDetallePedido } from './modal-detalle-pedido.js';

const PEDIDOS_POR_PAGINA = 20;
let paginaActual = 1;

let todosLosPedidos = []; // Todos los pedidos traídos de DB (status == 0)
let pedidosFiltrados = []; // Pedidos tras aplicar los filtros activos

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeHTML(str) {
    return str ? String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&#34;' }[tag] || tag)
    ) : '';
}

function parsearFechaHora(fechaStr, horaStr) {
    if (!fechaStr) return new Date(0);
    try {
        const partesFecha = fechaStr.split('/');
        if (partesFecha.length !== 3) return new Date(0);
        const dia = parseInt(partesFecha[0], 10);
        const mes = parseInt(partesFecha[1], 10) - 1;
        const anio = parseInt(partesFecha[2], 10);
        let horas = 0, minutos = 0;
        if (horaStr) {
            const partesHora = horaStr.split(':');
            if (partesHora.length >= 2) {
                horas = parseInt(partesHora[0], 10);
                minutos = parseInt(partesHora[1], 10);
            }
        }
        return new Date(anio, mes, dia, horas, minutos);
    } catch (e) {
        return new Date(0);
    }
}

function formatearFechaInput(fechaYYYYMMDD) {
    if (!fechaYYYYMMDD) return '';
    const partes = fechaYYYYMMDD.split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : '';
}

document.addEventListener('DOMContentLoaded', () => {
    const tablaBody = document.getElementById('tablaHistorialPedidosBody');
    const contenedorPaginacion = document.getElementById('contenedorPaginacion');

    const inputCliente = document.getElementById('filtroCliente');
    const inputTelefono = document.getElementById('filtroTelefono');
    const inputFechaInicio = document.getElementById('filtroFechaInicio');
    const inputFechaFin = document.getElementById('filtroFechaFin');
    const inputHoraInicio = document.getElementById('filtroHoraInicio');
    const inputHoraFin = document.getElementById('filtroHoraFin');
    const inputMontoMin = document.getElementById('filtroMontoMin');
    const inputMontoMax = document.getElementById('filtroMontoMax');
    const btnLimpiar = document.getElementById('btnLimpiarFiltros');

    if (window.innerWidth < 576) {
        const collapseFiltros = document.getElementById('collapseFiltros');
        if (collapseFiltros) {
            collapseFiltros.classList.remove('show');
            const btnToggle = document.querySelector('[data-target="#collapseFiltros"] i');
            if (btnToggle) btnToggle.className = 'fas fa-chevron-down';
        }
    }

    if (inputFechaFin) inputFechaFin.disabled = true;
    if (inputHoraFin) inputHoraFin.disabled = true;
    if (inputMontoMax) inputMontoMax.disabled = true;

    function alternarBloqueoTabla(bloquear) {
        if (!tablaBody) return;
        const botones = tablaBody.querySelectorAll('button');
        botones.forEach(btn => btn.disabled = bloquear);
        tablaBody.style.pointerEvents = bloquear ? 'none' : 'auto';
        tablaBody.style.opacity = bloquear ? '0.75' : '1';
    }

    // Carga inicial de Firestore (status == 0)
    async function cargarHistorialPedidos() {
        if (!tablaBody) return;

        try {
            const q = query(collection(db, 'Pedido'), where("status", "==", 0));
            const snapshot = await getDocs(q);

            todosLosPedidos = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            }));

            // Ordenar por fecha y hora más reciente primero
            todosLosPedidos.sort((a, b) => {
                const dateA = parsearFechaHora(a.fechaPedido, a.horaPedido);
                const dateB = parsearFechaHora(b.fechaPedido, b.horaPedido);
                return dateB - dateA;
            });

            paginaActual = 1;
            aplicarFiltros();

        } catch (error) {
            console.error("Error al consultar Firestore:", error);
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-danger py-3">
                        <i class="fas fa-exclamation-triangle mr-1"></i> Error al cargar el historial de pedidos.
                    </td>
                </tr>
            `;
            alternarBloqueoTabla(false);
        }
    }

    // Filtra la lista completa y recalcula la paginación
    function aplicarFiltros() {
        const busquedaCliente = normalizarTexto(inputCliente ? inputCliente.value.trim() : '');
        const busquedaTelefono = inputTelefono ? inputTelefono.value.trim() : '';
        const fechaInicioVal = inputFechaInicio ? inputFechaInicio.value : '';
        const fechaFinVal = inputFechaFin ? inputFechaFin.value : '';
        const horaInicioVal = inputHoraInicio ? inputHoraInicio.value : '';
        const horaFinVal = inputHoraFin ? inputHoraFin.value : '';
        const valMin = inputMontoMin && inputMontoMin.value !== '' ? parseFloat(inputMontoMin.value) : null;
        const valMax = inputMontoMax && inputMontoMax.value !== '' ? parseFloat(inputMontoMax.value) : null;

        if (valMin !== null && valMax !== null && valMax < valMin) return;
        if (fechaInicioVal && fechaFinVal && fechaFinVal < fechaInicioVal) return;
        if (horaInicioVal && horaFinVal && horaFinVal < horaInicioVal) return;

        pedidosFiltrados = todosLosPedidos.filter(ped => {
            if (busquedaCliente && !normalizarTexto(ped.nombrePide).includes(busquedaCliente)) return false;
            if (busquedaTelefono && !ped.telefono.includes(busquedaTelefono)) return false;

            if (fechaInicioVal && !fechaFinVal) {
                const fechaExacta = formatearFechaInput(fechaInicioVal);
                if (ped.fechaPedido !== fechaExacta) return false;
            } else if (fechaInicioVal && fechaFinVal) {
                const datePedido = parsearFechaHora(ped.fechaPedido, '00:00');
                const dateMin = parsearFechaHora(formatearFechaInput(fechaInicioVal), '00:00');
                const dateMax = parsearFechaHora(formatearFechaInput(fechaFinVal), '23:59');
                if (datePedido < dateMin || datePedido > dateMax) return false;
            }

            if (horaInicioVal && !horaFinVal) {
                if (ped.horaPedido !== horaInicioVal) return false;
            } else if (horaInicioVal && horaFinVal) {
                if (!ped.horaPedido || ped.horaPedido < horaInicioVal || ped.horaPedido > horaFinVal) return false;
            }

            const total = parseFloat(ped.totPagar || 0);
            if (valMin !== null && valMax === null) {
                if (total !== valMin) return false;
            } else if (valMin !== null && valMax !== null) {
                if (total < valMin || total > valMax) return false;
            }

            return true;
        });

        // Al cambiar cualquier filtro, siempre regresamos a la página 1
        paginaActual = 1;
        renderizarVistaActual();
    }

    function renderizarVistaActual() {
        const totalPaginas = Math.ceil(pedidosFiltrados.length / PEDIDOS_POR_PAGINA);
        if (paginaActual > totalPaginas && totalPaginas > 0) {
            paginaActual = totalPaginas;
        }

        const inicio = (paginaActual - 1) * PEDIDOS_POR_PAGINA;
        const fin = inicio + PEDIDOS_POR_PAGINA;
        const paginaPedidos = pedidosFiltrados.slice(inicio, fin);

        renderizarTabla(paginaPedidos);
        renderizarPaginacionUI(totalPaginas);
    }

    function renderizarTabla(lista) {
        if (!tablaBody) return;
        alternarBloqueoTabla(false);

        if (lista.length === 0) {
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-3">
                        No se encontraron registros en el historial coincidentes con la búsqueda.
                    </td>
                </tr>
            `;
            return;
        }

        tablaBody.innerHTML = lista.map(ped => {
            const horaFormateada = ped.horaPedido ? `${escapeHTML(ped.horaPedido)} hrs` : 'N/A';
            const total = Number(ped.totPagar || 0).toFixed(2);

            return `
                <tr>
                    <td class="align-middle text-center font-weight-bold text-dark">${escapeHTML(ped.nombrePide || 'Sin nombre')}</td>
                    <td class="align-middle font-weight-bold text-center">${escapeHTML(ped.telefono || 'N/A')}</td>
                    <td class="align-middle font-weight-bold text-center d-sm-none">
                        <div>${escapeHTML(ped.fechaPedido || 'N/A')}</div>
                        <div class="text-muted small">${horaFormateada}</div>
                    </td>
                    <td class="align-middle font-weight-bold text-center d-none d-sm-table-cell">${escapeHTML(ped.fechaPedido || 'N/A')}</td>
                    <td class="align-middle font-weight-bold text-center d-none d-sm-table-cell">${horaFormateada}</td>
                    <td class="align-middle text-center font-weight-bold text-success" style="color: #2e7d32 !important;">$${total}</td>
                    <td class="text-center align-middle">
                        <div class="acciones-grid-movil">
                            <button class="btn btn-info btn-circle-sm btn-ver-detalle" title="Ver detalles del pedido" data-id="${ped.id}">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderizarPaginacionUI(totalPaginas) {
        if (!contenedorPaginacion) return;

        if (totalPaginas <= 1) {
            contenedorPaginacion.innerHTML = '';
            return;
        }

        let htmlNav = '';
        htmlNav += `
            <li class="page-item ${paginaActual === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${paginaActual - 1}">&laquo;</a>
            </li>
        `;

        for (let i = 1; i <= totalPaginas; i++) {
            htmlNav += `
                <li class="page-item ${i === paginaActual ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }

        htmlNav += `
            <li class="page-item ${paginaActual === totalPaginas ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${paginaActual + 1}">&raquo;</a>
            </li>
        `;

        contenedorPaginacion.innerHTML = htmlNav;
    }

    if (contenedorPaginacion) {
        contenedorPaginacion.addEventListener('click', (e) => {
            e.preventDefault();
            const link = e.target.closest('.page-link');
            if (!link) return;
            const targetPage = parseInt(link.getAttribute('data-page'), 10);
            const totalPaginas = Math.ceil(pedidosFiltrados.length / PEDIDOS_POR_PAGINA);
            if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPaginas && targetPage !== paginaActual) {
                paginaActual = targetPage;
                renderizarVistaActual();
            }
        });
    }

    if (inputCliente) {
        inputCliente.addEventListener('input', () => {
            if (inputCliente.value.trim() !== '' && inputTelefono) inputTelefono.value = '';
            aplicarFiltros();
        });
    }

    if (inputTelefono) {
        inputTelefono.addEventListener('input', () => {
            if (inputTelefono.value.trim() !== '' && inputCliente) inputCliente.value = '';
            aplicarFiltros();
        });
    }

    if (inputFechaInicio) {
        inputFechaInicio.addEventListener('change', () => {
            if (inputFechaInicio.value) {
                inputFechaFin.disabled = false;
            } else {
                inputFechaFin.disabled = true;
                inputFechaFin.value = '';
            }
            aplicarFiltros();
        });
    }
    if (inputFechaFin) inputFechaFin.addEventListener('change', aplicarFiltros);

    if (inputHoraInicio) {
        inputHoraInicio.addEventListener('change', () => {
            if (inputHoraInicio.value) {
                inputHoraFin.disabled = false;
            } else {
                inputHoraFin.disabled = true;
                inputHoraFin.value = '';
            }
            aplicarFiltros();
        });
    }
    if (inputHoraFin) inputHoraFin.addEventListener('change', aplicarFiltros);

    if (inputMontoMin) {
        inputMontoMin.addEventListener('input', () => {
            const minVal = parseFloat(inputMontoMin.value);
            if (!isNaN(minVal) && minVal > 0) {
                inputMontoMax.disabled = false;
            } else {
                inputMontoMax.disabled = true;
                inputMontoMax.value = '';
            }
            aplicarFiltros();
        });
    }
    if (inputMontoMax) inputMontoMax.addEventListener('input', aplicarFiltros);

    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            if (inputCliente) inputCliente.value = '';
            if (inputTelefono) inputTelefono.value = '';
            if (inputFechaInicio) inputFechaInicio.value = '';
            if (inputFechaFin) {
                inputFechaFin.value = '';
                inputFechaFin.disabled = true;
            }
            if (inputHoraInicio) inputHoraInicio.value = '';
            if (inputHoraFin) {
                inputHoraFin.value = '';
                inputHoraFin.disabled = true;
            }
            if (inputMontoMin) inputMontoMin.value = '';
            if (inputMontoMax) {
                inputMontoMax.value = '';
                inputMontoMax.disabled = true;
            }
            aplicarFiltros();
        });
    }

    if (tablaBody) {
        tablaBody.addEventListener('click', (e) => {
            const btnVer = e.target.closest('.btn-ver-detalle');
            if (btnVer) {
                const pedidoId = btnVer.getAttribute('data-id');
                const pedidoObj = todosLosPedidos.find(p => p.id === pedidoId);
                if (pedidoObj) {
                    mostrarModalDetallePedido(pedidoObj);
                }
            }
        });
    }

    cargarHistorialPedidos();
});