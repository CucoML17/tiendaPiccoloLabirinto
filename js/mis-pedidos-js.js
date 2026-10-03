// js/mis-pedidos-js.js
import { mostrarConfirmacion } from './modal-confirm.js';
import { mostrarToast } from './toast.js';
import { db } from './firebase-config.js';
import { 
    collection, 
    doc, 
    getDoc,
    query, 
    where, 
    getDocs, 
    runTransaction 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { initHeader } from './header-externo.js';
import { obtenerOcrearIdCliente } from './utils-dispositivo.js';
import { buscarYVincularPedidoPorTelefono } from './utils-pedidos-cliente.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargar el header externo
    await cargarHeader();

    // 2. Buscar si el cliente tiene un pedido activo vinculado a su dispositivo
    await cargarPedidoCliente();

    // 3. Registrar el listener para el formulario de recuperación por teléfono
    const formRecuperar = document.getElementById('formRecuperarPedido');
    if (formRecuperar) {
        formRecuperar.addEventListener('submit', manejarRecuperacionPorTelefono);
    }
});

//Carga el header dinámico.
async function cargarHeader() {
    try {
        const response = await fetch('header.html');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            headerContainer.innerHTML = html;
            if (typeof initHeader === 'function') {
                await initHeader();
            }
        }
    } catch (error) {
        console.error('Error al cargar el header:', error);
    }
}

//Controla la visibilidad exclusiva entre las 3 pantallas de la interfaz.
function mostrarPantalla(estado) {
    const contenedorCargando = document.getElementById('contenedorCargando');
    const sinPedidoContainer = document.getElementById('sinPedidoContainer');
    const tarjetaPrincipal = document.getElementById('tarjetaPrincipalPedido');

    // Ocultar todo por defecto
    if (contenedorCargando) contenedorCargando.classList.add('d-none');
    if (sinPedidoContainer) sinPedidoContainer.classList.add('d-none');
    if (tarjetaPrincipal) tarjetaPrincipal.classList.add('d-none');

    // Mostrar únicamente el contenedor correspondiente
    if (estado === 'cargando') {
        if (contenedorCargando) contenedorCargando.classList.remove('d-none');
    } else if (estado === 'sinPedido') {
        if (sinPedidoContainer) sinPedidoContainer.classList.remove('d-none');
    } else if (estado === 'conPedido') {
        if (tarjetaPrincipal) tarjetaPrincipal.classList.remove('d-none');
    }
}

//Busca y procesa el pedido activo (status == 1) correspondiente al idCliente local
async function cargarPedidoCliente() {
    mostrarPantalla('cargando');

    try {
        const idCliente = obtenerOcrearIdCliente();

        // Consultar únicamente pedido activo para el cliente actual
        const qPedido = query(
            collection(db, 'Pedido'),
            where('idCliente', '==', idCliente),
            where('status', '==', 1)
        );

        const snapshotPedido = await getDocs(qPedido);

        //Si no hay pedido: Mostramos la pantalla con el formulario de recuperación por teléfono
        if (snapshotPedido.empty) {
            mostrarPantalla('sinPedido');
            return;
        }

        //Extraer datos del pedido
        const docPedido = snapshotPedido.docs[0];
        const pedidoData = { id: docPedido.id, ...docPedido.data() };

        //Consultar los detalles del pedido
        const qDetalles = query(
            collection(db, 'DetallePedido'),
            where('idPedido', '==', pedidoData.id)
        );

        const snapshotDetalles = await getDocs(qDetalles);
        const detalles = snapshotDetalles.docs.map(doc => doc.data());

        //Mapear la información del catálogo usando lectura directa getDoc
        const detallesConProducto = await Promise.all(
            detalles.map(async (det) => {
                try {
                    const prodSnap = await getDoc(doc(db, 'Producto', det.idProducto));
                    if (prodSnap.exists()) {
                        const prodData = prodSnap.data();
                        return {
                            ...det,
                            nombreProducto: prodData.nombreProducto || 'Producto no especificado',
                            precio: prodData.precio || 0,
                            imagenUrl: prodData.imagenUrl || 'https://via.placeholder.com/65'
                        };
                    }
                } catch (e) {
                    console.error('Error al recuperar datos del producto:', det.idProducto, e);
                }
                return {
                    ...det,
                    nombreProducto: 'Producto no disponible',
                    precio: 0,
                    imagenUrl: 'https://via.placeholder.com/65'
                };
            })
        );

        // Renderizar datos en la vista y mostrar la tarjeta del pedido
        renderizarVistaPedido(pedidoData, detallesConProducto);
        mostrarPantalla('conPedido');

    } catch (error) {
        console.error('Error al obtener la información del pedido:', error);
        mostrarToast('No se pudo cargar el pedido. Inténtalo más tarde.', 'danger');
        mostrarPantalla('sinPedido');
    }
}

//Manejar el evento de búsqueda y recuperación por número telefónico.
async function manejarRecuperacionPorTelefono(e) {
    e.preventDefault();

    const inputTel = document.getElementById('inputTelefonoRecuperar');
    const errText = document.getElementById('errorTelefonoRecuperar');
    const btnSubmit = document.getElementById('btnRecuperarPedido');
    const telefono = inputTel ? inputTel.value.trim() : '';

    const regexTel = /^[0-9]{10}$/;

    if (!regexTel.test(telefono)) {
        if (errText) errText.classList.remove('d-none');
        return;
    }

    if (errText) errText.classList.add('d-none');

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Buscando...';
    }

    try {
        //Llama a utils-pedidos-cliente.js que busca el pedido activo con ese tel 
        //y le revinculará el idCliente de esta sesión.
        const pedidoEncontrado = await buscarYVincularPedidoPorTelefono(telefono);

        if (pedidoEncontrado) {
            mostrarToast('¡Pedido encontrado y vinculado a tu sesión!', 'success');
            if (inputTel) inputTel.value = '';
            // Vuelve a consultar: como ya se vinculó, ahora lo encontrará y mostrará la tarjeta
            await cargarPedidoCliente();
        } else {
            mostrarToast('No se encontró ningún pedido activo asociado a este número.', 'warning');
        }
    } catch (err) {
        console.error('Error al buscar pedido por teléfono:', err);
        mostrarToast('Ocurrió un error al intentar consultar el pedido.', 'danger');
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fas fa-search mr-1"></i> Recuperar';
        }
    }
}

//Inyecta los datos del pedido en las etiquetas HTML.
function renderizarVistaPedido(pedido, detalles) {
    const contenedorLista = document.getElementById('contenedorLista');
    const footerPedido = document.getElementById('footerPedido');

    const lblFolio = document.getElementById('lblFolioPedido');
    const badgeEstado = document.getElementById('badgeEstadoPedido');
    const lblNombre = document.getElementById('lblNombreCliente');
    const lblTelefono = document.getElementById('lblTelefonoCliente');
    const lblFecha = document.getElementById('lblFechaPedido');
    const lblHora = document.getElementById('lblHoraPedido');
    const alertaNotas = document.getElementById('alertaNotasPedido');
    const txtNotas = document.getElementById('txtNotasPedido');
    const listaProductos = document.getElementById('listaProductosPedido');
    const badgeTotalArticulos = document.getElementById('badgeTotalArticulos');
    const lblMontoTotal = document.getElementById('lblMontoTotalPedido');
    const btnCancelar = document.getElementById('btnCancelarPedidoCliente');

    if (lblFolio) lblFolio.textContent = `#${pedido.id}`;

    if (badgeEstado) {
        badgeEstado.textContent = 'En Proceso';
        badgeEstado.className = 'badge badge-dark p-2 text-uppercase font-weight-bold';
    }

    if (lblNombre) lblNombre.textContent = pedido.nombrePide || 'N/A';
    if (lblTelefono) lblTelefono.textContent = pedido.telefono || 'N/A';
    if (lblFecha) lblFecha.textContent = pedido.fechaPedido || '--/--/----';
    if (lblHora) lblHora.textContent = pedido.horaPedido || '--:--';

    if (pedido.notas && pedido.notas.trim() !== '') {
        if (txtNotas) txtNotas.textContent = pedido.notas;
        if (alertaNotas) alertaNotas.classList.remove('d-none');
    } else {
        if (alertaNotas) alertaNotas.classList.add('d-none');
    }

    let totalPiezas = 0;
    if (listaProductos) {
        let htmlItems = '';
        detalles.forEach((item, index) => {
            const cantidad = Number(item.cantidad) || 0;
            const precio = Number(item.precio) || 0;
            const subtotal = cantidad * precio;
            totalPiezas += cantidad;

            htmlItems += `
            <li class="list-group-item py-2 py-sm-3 px-2 px-sm-3">
                <div class="row align-items-center no-gutters row-sm">
                    <div class="col-1 text-center font-weight-bold text-muted d-none d-md-block">${index + 1}</div>
                    
                    <!-- Información Producto e Imagen -->
                    <div class="col-8 col-md-5 d-flex align-items-center">
                        <img src="${item.imagenUrl}" alt="${item.nombreProducto}" class="order-item-img mr-2 mr-sm-3 shadow-sm flex-shrink-0">
                        <div class="overflow-hidden">
                            <h6 class="mb-0 font-weight-bold text-dark text-truncate" style="font-size: 14px;">${item.nombreProducto}</h6>
                            <small class="text-muted d-md-none d-block" style="font-size: 12px;">
                                $${precio.toFixed(2)} × ${cantidad}
                            </small>
                        </div>
                    </div>

                    <!-- Vistas de escritorio (Precio Unitario y Cantidad) -->
                    <div class="col-md-2 text-center d-none d-md-block">
                        <span class="text-dark">$${precio.toFixed(2)}</span>
                    </div>

                    <div class="col-md-2 text-center d-none d-md-flex align-items-center justify-content-center">
                        <input type="text" class="form-control form-control-sm input-cant-cart font-weight-bold text-center" value="${cantidad}" readonly style="width: 50px; pointer-events: none;">
                    </div>  
                    
                    <!-- Subtotal alineado a la derecha en la misma línea en Mobile -->
                    <div class="col-4 col-md-2 text-right d-flex align-items-center justify-content-end">
                        <span class="font-weight-bold text-dark h6 mb-0" style="font-size: 15px;">$${subtotal.toFixed(2)}</span>
                    </div>
                </div>
            </li>
            `;
        });
        listaProductos.innerHTML = htmlItems;
    }

    if (badgeTotalArticulos) badgeTotalArticulos.textContent = `${totalPiezas} artículo(s)`;
    if (lblMontoTotal) lblMontoTotal.textContent = `$${Number(pedido.totPagar || 0).toFixed(2)}`;

    if (contenedorLista) contenedorLista.classList.remove('d-none');
    if (footerPedido) footerPedido.classList.remove('d-none');

    if (btnCancelar) {
        btnCancelar.onclick = () => ejecutarCancelacionAtomiaca(pedido.id);
    }
}


 //Transacción para cancelar pedido y restablecer stock.
 //Corregido: Separa estrictamente la fase de Lecturas (get) de la fase de Escrituras (update/delete).

async function ejecutarCancelacionAtomiaca(idPedido) {
    const confirmado = await mostrarConfirmacion({
        titulo: 'Cancelar Pedido',
        mensaje: '¿Estás seguro de que deseas cancelar tu pedido? Se eliminará la solicitud y el stock será devuelto.',
        btnAceptarText: 'Sí, cancelar pedido',
        btnCancelarText: 'Mantener pedido',
        btnAceptarClass: 'btn-danger'
    });

    if (!confirmado) return;

    const btnCancelar = document.getElementById('btnCancelarPedidoCliente');
    if (btnCancelar) {
        btnCancelar.disabled = true;
        btnCancelar.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Cancelando...';
    }

    try {
        // 1. Obtener los documentos de DetallePedido asociados a este idPedido
        const qDetalles = query(
            collection(db, 'DetallePedido'),
            where('idPedido', '==', idPedido)
        );
        const snapshotDetalles = await getDocs(qDetalles);

        if (snapshotDetalles.empty) {
            throw new Error('No se encontraron los detalles del pedido para cancelar.');
        }

        // Mapear los datos de los detalles (incluye el ID propio del documento de DetallePedido)
        const listaDetalles = snapshotDetalles.docs.map(docSnap => ({
            idDetalle: docSnap.id,
            refDetalle: docSnap.ref,
            idProducto: docSnap.data().idProducto,
            cantidad: Number(docSnap.data().cantidad) || 0
        }));

        //2. Ejecutar Transacción Atómica
        await runTransaction(db, async (transaction) => {
            const pedidoRef = doc(db, 'Pedido', idPedido);

            //1. Todas las lecturas reads
            const pedidoDoc = await transaction.get(pedidoRef);
            if (!pedidoDoc.exists()) {
                throw new Error('El pedido especificado ya no existe o fue procesado previamente.');
            }

            //Lee el estado actual de cada Producto en la BD
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


            //2. Todas las escrituras
            //Sumar y devolver la cantidad al campo 'cantidad' de cada Producto
            for (const prod of productosAActualizar) {
                transaction.update(prod.ref, { cantidad: prod.nuevoStock });
            }

            //Eliminar cada documento de DetallePedido
            for (const detalle of listaDetalles) {
                transaction.delete(detalle.refDetalle);
            }

            //Eliminar el documento del Pedido principal
            transaction.delete(pedidoRef);
        });

        mostrarToast('Tu pedido ha sido cancelado.', 'success');

        setTimeout(() => {
            cargarPedidoCliente();
        }, 1200);

    } catch (error) {
        console.error('Error durante la transacción de cancelación:', error);
        mostrarToast(error.message || 'Error al intentar cancelar el pedido.', 'danger');

        if (btnCancelar) {
            btnCancelar.disabled = false;
            btnCancelar.innerHTML = '<i class="fas fa-times-circle mr-1"></i> Cancelar Pedido';
        }
    }
}