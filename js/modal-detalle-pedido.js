// js/modal-detalle-pedido.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

//Para prevenir vulnerabilidades XSS
function escapeHTML(str) {
    return str ? String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    ) : '';
}

//Muestra el modal con el desglose de productos de un pedido
export async function mostrarModalDetallePedido(pedido) {
    const $modal = $('#modalDetallePedido');
    const elCliente = document.getElementById('detModalCliente');
    const elTelefono = document.getElementById('detModalTelefono');
    const elTotal = document.getElementById('detModalTotal');
    const elTablaBody = document.getElementById('detModalBodyTabla');

    if (!elTablaBody) return;

    // 1. Poner datos principales del header del modal
    if (elCliente) elCliente.textContent = pedido.nombrePide || 'Sin nombre';
    if (elTelefono) elTelefono.textContent = pedido.telefono || 'N/A';
    if (elTotal) elTotal.textContent = `$${Number(pedido.totPagar || 0).toFixed(2)}`;

    //Mostrar estado de carga en la tabla mientras consultamos
    elTablaBody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center py-4 text-muted">
                <i class="fas fa-spinner fa-spin fa-2x mb-2 d-block text-info"></i>
                Obteniendo productos del pedido...
            </td>
        </tr>
    `;

    //Abrir modal inmediatamente para mejor UX
    $modal.modal('show');

    try {
        //2. Consultar DetallePedido filtrando por idPedido
        const qDetalles = query(
            collection(db, 'DetallePedido'),
            where('idPedido', '==', pedido.id)
        );
        const snapshotDetalles = await getDocs(qDetalles);

        if (snapshotDetalles.empty) {
            elTablaBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-warning py-3">
                        <i class="fas fa-exclamation-triangle mr-1"></i> No se encontraron detalles para este pedido.
                    </td>
                </tr>
            `;
            return;
        }

        //3. Obtener los datos de cada Producto asociado a los detalles
        const promesasDetalles = snapshotDetalles.docs.map(async (docDet) => {
            const dataDetalle = docDet.data();
            const cantidad = Number(dataDetalle.cantidad || 0);

            let producto = {
                nombreProducto: 'Producto no disponible',
                precio: 0,
                imagenUrl: ''
            };

            if (dataDetalle.idProducto) {
                try {
                    const prodRef = doc(db, 'Producto', dataDetalle.idProducto);
                    const prodSnap = await getDoc(prodRef);
                    if (prodSnap.exists()) {
                        producto = prodSnap.data();
                    }
                } catch (e) {
                    console.error('Error al cargar producto:', e);
                }
            }

            const precioUnitario = Number(producto.precio || 0);
            const subtotal = cantidad * precioUnitario;

            return {
                nombre: producto.nombreProducto || 'Sin nombre',
                imagenUrl: producto.imagenUrl || '',
                cantidad: cantidad,
                precioUnitario: precioUnitario,
                subtotal: subtotal
            };
        });

        const listaProductos = await Promise.all(promesasDetalles);

        //4. Renderizar filas de productos
        elTablaBody.innerHTML = listaProductos.map(prod => {
            const imgHTML = prod.imagenUrl 
                ? `<img src="${escapeHTML(prod.imagenUrl)}" alt="Producto" class="rounded object-fit-cover" style="width: 45px; height: 45px; object-fit: cover;">`
                : `<div class="bg-light rounded d-flex align-items-center justify-content-center border" style="width: 45px; height: 45px;"><i class="fas fa-box text-secondary"></i></div>`;

            return `
                <tr>
                    <td class="text-center align-middle p-2">
                        ${imgHTML}
                    </td>
                    <td class="align-middle font-weight-bold text-dark text-left">
                        ${escapeHTML(prod.nombre)}
                    </td>
                    <td class="text-center align-middle font-weight-bold">
                        ${prod.cantidad}
                    </td>
                    <td class="text-center align-middle text-dark">
                        $${prod.precioUnitario.toFixed(2)}
                    </td>
                    <td class="text-right align-middle font-weight-bold text-success" style="color: #2e7d32 !important;">
                        $${prod.subtotal.toFixed(2)}
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error("Error al obtener los detalles del pedido:", error);
        elTablaBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-danger py-3">
                    <i class="fas fa-exclamation-circle mr-1"></i> Error al cargar el detalle de productos.
                </td>
            </tr>
        `;
    }
}