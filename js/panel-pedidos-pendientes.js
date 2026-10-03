// js/panel-pedidos-pendientes.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, where, doc, runTransaction, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { mostrarConfirmacion } from './modal-confirm.js';
import { mostrarToast } from './toast.js';

import { mostrarModalDetallePedido } from './modal-detalle-pedido.js';

//Estado local en memoria para los pedidos pendientes
let pedidosLocales = [];

//para normalizar texto (Quitar acentos/tildes y pasar a minúsculas)
function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

//Prevenir vulnerabilidades XSS
function escapeHTML(str) {
    return str ? String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    ) : '';
}

//Parsear la fecha (DD/MM/YYYY) y la hora (HH:MM) a un objeto Date para ordenamiento preciso
function parsearFechaHora(fechaStr, horaStr) {
    if (!fechaStr) return new Date(8640000000000000);
    
    try {
        const partesFecha = fechaStr.split('/');
        if (partesFecha.length !== 3) return new Date(8640000000000000);
        
        const dia = parseInt(partesFecha[0], 10);
        const mes = parseInt(partesFecha[1], 10) - 1;
        const anio = parseInt(partesFecha[2], 10);

        let horas = 0;
        let minutos = 0;

        if (horaStr) {
            const partesHora = horaStr.split(':');
            if (partesHora.length >= 2) {
                horas = parseInt(partesHora[0], 10);
                minutos = parseInt(partesHora[1], 10);
            }
        }

        return new Date(anio, mes, dia, horas, minutos);
    } catch (e) {
        return new Date(8640000000000000);
    }
}

//Para obtener la fecha y hora actual ajustada a la zona horaria de México (UTC-6)
function obtenerFechaHoraActualMexico() {
    const ahora = new Date();
    //Convertir la hora local/servidor a la cadena ISO en la zona horaria 'America/Mexico_City'
    const opciones = {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };

    const formateador = new Intl.DateTimeFormat('es-MX', opciones);
    const partes = formateador.formatToParts(ahora);

    let dia, mes, anio, horas, minutos;
    partes.forEach(p => {
        if (p.type === 'day') dia = parseInt(p.value, 10);
        if (p.type === 'month') mes = parseInt(p.value, 10) - 1; // Mes base 0 en Date
        if (p.type === 'year') anio = parseInt(p.value, 10);
        if (p.type === 'hour') horas = parseInt(p.value, 10);
        if (p.type === 'minute') minutos = parseInt(p.value, 10);
    });

    return {
        fechaHoy: new Date(anio, mes, dia),
        horasActuales: horas,
        minutosActuales: minutos,
        anio,
        mes,
        dia
    };
}

//Verificar si un pedido está vencido (Fecha anterior a hoy O es hoy pero pasaron las 6:30 PM en México)
function esPedidoVencido(fechaStr) {
    if (!fechaStr) return false;

    const partes = fechaStr.split('/');
    if (partes.length !== 3) return false;

    const diaPedido = parseInt(partes[0], 10);
    const mesPedido = parseInt(partes[1], 10) - 1;
    const anioPedido = parseInt(partes[2], 10);

    const fechaPedidoObj = new Date(anioPedido, mesPedido, diaPedido);

    // Obtener la hora actual de México
    const { fechaHoy, horasActuales, minutosActuales } = obtenerFechaHoraActualMexico();

    //1. Si la fecha del pedido es anterior a la fecha de hoy en México, está vencido
    if (fechaPedidoObj < fechaHoy) {
        return true;
    }

    //2. Si la fecha del pedido es exactamente hoy en México:
    //Evaluar si la hora actual de México ya rebasó las 6:30 PM (18:30 hrs)
    if (fechaPedidoObj.getTime() === fechaHoy.getTime()) {
        if (horasActuales > 18) {
            return true; 
        }
        if (horasActuales === 18 && minutosActuales >= 30) {
            return true; 
        }
    }

    return false;
}

document.addEventListener('DOMContentLoaded', () => {
    //Referencias a los elementos del DOM
    const tablaBody = document.getElementById('tablaPedidosPendientesBody');
    const inputCliente = document.getElementById('filtroCliente');
    const inputTelefono = document.getElementById('filtroTelefono');
    const inputFecha = document.getElementById('filtroFecha');
    const inputHora = document.getElementById('filtroHora');
    const inputMontoMin = document.getElementById('filtroMontoMin');
    const inputMontoMax = document.getElementById('filtroMontoMax');
    const btnLimpiar = document.getElementById('btnLimpiarFiltros');


    //Colapsar automáticamente la barra de filtros solo en smartphones
    if (window.innerWidth < 576) {
        const collapseFiltros = document.getElementById('collapseFiltros');
        if (collapseFiltros) {
            collapseFiltros.classList.remove('show');
            //Actualizar el icono de la flecha si es necesario
            const btnToggle = document.querySelector('[data-target="#collapseFiltros"] i');
            if (btnToggle) {
                btnToggle.className = 'fas fa-chevron-down';
            }
        }
    }    

    //Inicializar estado de monto máximo bloqueado
    if (inputMontoMax) inputMontoMax.disabled = true;

    //Controlar bloqueo global de la interfaz durante operaciones asíncronas
    function alternarBloqueoTabla(bloquear) {
        if (!tablaBody) return;
        const botones = tablaBody.querySelectorAll('button');

        botones.forEach(btn => {
            btn.disabled = bloquear;
        });

        if (bloquear) {
            tablaBody.style.pointerEvents = 'none';
            tablaBody.style.opacity = '0.75';
        } else {
            tablaBody.style.pointerEvents = 'auto';
            tablaBody.style.opacity = '1';
        }
    }

    //1. Carga de datos (Pedidos Pendientes - status == 1)
    async function cargarPedidosPendientes() {
        try {
            const q = query(collection(db, 'Pedido'), where("status", "==", 1));
            const snapshot = await getDocs(q);

            pedidosLocales = [];
            snapshot.forEach(docSnap => {
                pedidosLocales.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });
            });

            ordenarPedidos();
            aplicarFiltros();

        } catch (error) {
            console.error("Error al obtener los pedidos pendientes:", error);
            if (tablaBody) {
                tablaBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-danger py-3">
                            <i class="fas fa-exclamation-triangle mr-1"></i> Error al cargar el listado de pedidos pendientes.
                        </td>
                    </tr>
                `;
            }
            alternarBloqueoTabla(false);
        }
    }

    //Algoritmo de ordenamiento por fecha y hora
    function ordenarPedidos() {
        pedidosLocales.sort((a, b) => {
            const dateA = parsearFechaHora(a.fechaPedido, a.horaPedido);
            const dateB = parsearFechaHora(b.fechaPedido, b.horaPedido);
            return dateA - dateB;
        });
    }

    //2. Renderizado de la tabla con el badge vencido
    function renderizarTabla(lista) {
        if (!tablaBody) return;

        //Asegurar que el bloqueo se retire al renderizar
        alternarBloqueoTabla(false);

        if (lista.length === 0) {
            tablaBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-3">
                    No se encontraron pedidos pendientes registrados o coincidentes con los filtros de búsqueda.
                </td>
            </tr>
            `;
            return;
        }

        tablaBody.innerHTML = lista.map(ped => {
            const horaFormateada = ped.horaPedido ? `${escapeHTML(ped.horaPedido)} hrs` : 'N/A';
            const total = Number(ped.totPagar || 0).toFixed(2);
            const vencido = esPedidoVencido(ped.fechaPedido);

            //Badge condicional si el pedido está vencido
            const badgeVencido = vencido 
                ? `<span class="badge badge-danger badge-vencido-sm ml-sm-1" style="font-size: 10px;"><i class="fas fa-clock mr-1"></i>Vencido</span>` 
                : '';

            return `
            <tr>
                <!-- Cliente -->
                <td class="align-middle text-center font-weight-bold text-dark">
                    ${escapeHTML(ped.nombrePide || 'Sin nombre')} ${badgeVencido}
                </td>

                <!-- Teléfono -->
                <td class="align-middle font-weight-bold text-center">
                    ${escapeHTML(ped.telefono || 'N/A')}
                </td>

                <!-- Fecha y Hora unificadas (SOLO MÓVIL) -->
                <td class="align-middle font-weight-bold text-center d-sm-none">
                    <div>${escapeHTML(ped.fechaPedido || 'N/A')}</div>
                    <div class="text-primary">${horaFormateada}</div>
                </td>

                <!-- Fecha Entrega (SOLO ESCRITORIO / TABLET) -->
                <td class="align-middle font-weight-bold text-center d-none d-sm-table-cell">
                    ${escapeHTML(ped.fechaPedido || 'N/A')}
                </td>

                <!-- Hora Entrega (SOLO ESCRITORIO / TABLET) -->
                <td class="align-middle font-weight-bold text-center d-none d-sm-table-cell">
                    ${horaFormateada}
                </td>

                <!-- Total a Pagar -->
                <td class="align-middle text-center font-weight-bold text-success" style="color: #2e7d32 !important;">
                    $${total}
                </td>

                <!-- Acciones -->
                <td class="text-center align-middle">
                    <div class="acciones-grid-movil">
                        <button class="btn btn-info btn-circle-sm btn-ver-detalle" title="Ver detalles del pedido" data-id="${ped.id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-teal btn-circle-sm text-white btn-completar" title="Marcar como Completado" data-id="${ped.id}">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-danger btn-circle-sm btn-cancelar" title="Cancelar pedido" data-id="${ped.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }
    //3. Motor de filtrado combinado
    function aplicarFiltros() {
        const busquedaCliente = normalizarTexto(inputCliente ? inputCliente.value.trim() : '');
        const busquedaTelefono = inputTelefono ? inputTelefono.value.trim() : '';
        const fechaSeleccionada = inputFecha ? inputFecha.value : '';
        const horaSeleccionada = inputHora ? inputHora.value : '';

        const valMin = inputMontoMin && inputMontoMin.value !== '' ? parseFloat(inputMontoMin.value) : null;
        const valMax = inputMontoMax && inputMontoMax.value !== '' ? parseFloat(inputMontoMax.value) : null;

        if (valMin !== null && valMax !== null && valMax < valMin) {
            return;
        }

        let fechaFiltroFormateada = '';
        if (fechaSeleccionada) {
            const partes = fechaSeleccionada.split('-');
            if (partes.length === 3) {
                fechaFiltroFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
            }
        }

        const pedidosFiltrados = pedidosLocales.filter(ped => {
            if (busquedaCliente && !normalizarTexto(ped.nombrePide).includes(busquedaCliente)) {
                return false;
            }

            if (busquedaTelefono && !ped.telefono.includes(busquedaTelefono)) {
                return false;
            }

            if (fechaFiltroFormateada && ped.fechaPedido !== fechaFiltroFormateada) {
                return false;
            }

            if (horaSeleccionada && ped.horaPedido !== horaSeleccionada) {
                return false;
            }

            const total = parseFloat(ped.totPagar || 0);
            if (valMin !== null && valMax === null) {
                if (total !== valMin) return false;
            } else if (valMin !== null && valMax !== null) {
                if (total < valMin || total > valMax) return false;
            }

            return true;
        });

        renderizarTabla(pedidosFiltrados);
    }

    // 4. Lógica de cancelación de pedido
    async function ejecutarCancelacionAtomica(idPedido, btnElemento) {
        const confirmado = await mostrarConfirmacion({
            titulo: 'Cancelar Pedido',
            mensaje: '¿Estás seguro de que deseas cancelar este pedido? Se eliminará la solicitud y el stock de los productos será devuelto.',
            btnAceptarText: 'Sí, cancelar pedido',
            btnCancelarText: 'Mantener pedido',
            btnAceptarClass: 'btn-danger'
        });

        if (!confirmado) return;

        //Bloquear todos los botones de la tabla y poner animación en el botón activo
        alternarBloqueoTabla(true);
        if (btnElemento) {
            btnElemento.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        try {
            //1. Obtener los documentos de DetallePedido asociados a este idPedido
            const qDetalles = query(
                collection(db, 'DetallePedido'),
                where('idPedido', '==', idPedido)
            );
            const snapshotDetalles = await getDocs(qDetalles);

            if (snapshotDetalles.empty) {
                throw new Error('No se encontraron los detalles del pedido para cancelar.');
            }

            const listaDetalles = snapshotDetalles.docs.map(docSnap => ({
                idDetalle: docSnap.id,
                refDetalle: docSnap.ref,
                idProducto: docSnap.data().idProducto,
                cantidad: Number(docSnap.data().cantidad) || 0
            }));

            //2. Transacción Atómica
            await runTransaction(db, async (transaction) => {
                const pedidoRef = doc(db, 'Pedido', idPedido);
                
                //1. Reads
                const pedidoDoc = await transaction.get(pedidoRef);
                if (!pedidoDoc.exists()) {
                    throw new Error('El pedido especificado ya no existe o fue procesado previamente.');
                }

                const productosAActualizar = [];

                for (const detalle of listaDetalles) {
                    if (!detalle.idProducto) continue;

                    const prodRef = doc(db, 'Producto', detalle.idProducto);
                    const prodDoc = await transaction.get(prodRef);

                    if (prodDoc.exists()) {
                        const stockActual = Number(prodDoc.data().cantidad) || 0;
                        const nuevoStock = stockActual + detalle.cantidad;

                        productosAActualizar.push({
                            ref: prodRef,
                            nuevoStock: nuevoStock
                        });
                    }
                }

                //2. Writes y deletes
                for (const prod of productosAActualizar) {
                    transaction.update(prod.ref, { cantidad: prod.nuevoStock });
                }

                for (const detalle of listaDetalles) {
                    transaction.delete(detalle.refDetalle);
                }

                transaction.delete(pedidoRef);
            });

            mostrarToast('El pedido ha sido cancelado y el stock restablecido.', 'success');

            // Recargar listado en la vista (desbloquea la tabla automáticamente al renderizar)
            cargarPedidosPendientes();

        } catch (error) {
            console.error('Error durante la transacción de cancelación:', error);
            mostrarToast(error.message || 'Error al intentar cancelar el pedido.', 'danger');

            // Restaurar estado en caso de error
            alternarBloqueoTabla(false);
            if (btnElemento) {
                btnElemento.innerHTML = '<i class="fas fa-trash"></i>';
            }
        }
    }

    //4.1 Lógica para marcar pedido como completado (status 0)
    async function ejecutarCompletarPedido(idPedido, nombreCliente, btnElemento) {
        const confirmado = await mostrarConfirmacion({
            titulo: 'Completar Pedido',
            mensaje: `¿Deseas marcar el pedido de "${escapeHTML(nombreCliente)}" como completado?`,
            btnAceptarText: 'Sí, completar',
            btnCancelarText: 'Cancelar',
            btnAceptarClass: 'btn-teal'
        });

        if (!confirmado) return;

        alternarBloqueoTabla(true);
        if (btnElemento) {
            btnElemento.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        try {
            const pedidoRef = doc(db, 'Pedido', idPedido);
            await updateDoc(pedidoRef, {
                status: 0
            });

            mostrarToast(`El pedido de "${escapeHTML(nombreCliente)}" ha sido marcado como completado.`, 'success');

            // Recargar listado (la función renderizarTabla se encarga de desbloquear)
            cargarPedidosPendientes();

        } catch (error) {
            console.error('Error al completar el pedido:', error);
            mostrarToast('Ocurrió un error al intentar completar el pedido.', 'danger');

            alternarBloqueoTabla(false);
            if (btnElemento) {
                btnElemento.innerHTML = '<i class="fas fa-check"></i>';
            }
        }
    }

    //5. Controles de eventos y exclusividad
    if (inputCliente) {
        inputCliente.addEventListener('input', () => {
            if (inputCliente.value.trim() !== '' && inputTelefono) {
                inputTelefono.value = '';
            }
            aplicarFiltros();
        });
    }

    if (inputTelefono) {
        inputTelefono.addEventListener('input', () => {
            if (inputTelefono.value.trim() !== '' && inputCliente) {
                inputCliente.value = '';
            }
            aplicarFiltros();
        });
    }

    if (inputFecha) inputFecha.addEventListener('change', aplicarFiltros);
    if (inputHora) inputHora.addEventListener('change', aplicarFiltros);

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

    if (inputMontoMax) {
        inputMontoMax.addEventListener('input', aplicarFiltros);
    }

    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            if (inputCliente) inputCliente.value = '';
            if (inputTelefono) inputTelefono.value = '';
            if (inputFecha) inputFecha.value = '';
            if (inputHora) inputHora.value = '';
            if (inputMontoMin) inputMontoMin.value = '';
            if (inputMontoMax) {
                inputMontoMax.value = '';
                inputMontoMax.disabled = true;
            }
            renderizarTabla(pedidosLocales);
        });
    }

    // 6. Delegación de eventos
    if (tablaBody) {
        tablaBody.addEventListener('click', (e) => {
            const btnVer = e.target.closest('.btn-ver-detalle');
            const btnCompletar = e.target.closest('.btn-completar');
            const btnCancelar = e.target.closest('.btn-cancelar');

            if (btnVer) {
                const pedidoId = btnVer.getAttribute('data-id');
                const pedidoObj = pedidosLocales.find(p => p.id === pedidoId);
                if (pedidoObj) {
                    mostrarModalDetallePedido(pedidoObj);
                }
            }

            if (btnCompletar) {
                const pedidoId = btnCompletar.getAttribute('data-id');
                // Buscamos el objeto del pedido local para obtener su nombre exacto
                const pedidoObj = pedidosLocales.find(p => p.id === pedidoId);
                const nombreCliente = pedidoObj ? pedidoObj.nombrePide : 'este cliente';
                
                ejecutarCompletarPedido(pedidoId, nombreCliente, btnCompletar);
            }

            if (btnCancelar) {
                const pedidoId = btnCancelar.getAttribute('data-id');
                ejecutarCancelacionAtomica(pedidoId, btnCancelar);
            }
        });
    }

    cargarPedidosPendientes();
});