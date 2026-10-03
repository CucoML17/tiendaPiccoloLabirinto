// js/carrito-compras-js.js
import { obtenerCarrito, actualizarCantidadCarrito, vaciarCarrito, obtenerTotalItemsCarrito } from './carrito.js';
import { mostrarConfirmacion } from './modal-confirm.js';
import { mostrarToast } from './toast.js';
import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { initHeader } from './header-externo.js';

document.addEventListener('DOMContentLoaded', async () => {
    await cargarHeader();

    window.addEventListener('carritoActualizado', actualizarBadgeCarrito);
    actualizarBadgeCarrito();

    await renderizarCarrito();

    document.getElementById('btnCancelarPedido')?.addEventListener('click', manejarVaciarCarrito);
    document.getElementById('btnContinuarPedido')?.addEventListener('click', manejarContinuarPedido);
    document.getElementById('btnContinuarPedidoMobile')?.addEventListener('click', manejarContinuarPedido);
});

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

function actualizarBadgeCarrito() {
    const badge = document.getElementById('carritoBadge');
    if (badge) {
        badge.textContent = obtenerTotalItemsCarrito();
    }
}

// Función auxiliar para actualizar el estado del texto sutil
function actualizarNotaMontoMinimo(montoTotal) {
    const notaMinimo = document.getElementById('notaMontoMinimo');
    if (!notaMinimo) return;

    if (montoTotal < 100) {
        const faltante = (100 - montoTotal).toFixed(2);
        notaMinimo.className = 'text-muted font-weight-bold transition-all';
        notaMinimo.innerHTML = `<i class="fas fa-info-circle mr-1"></i> Compra mínima: $100.00 (Te faltan $${faltante})`;
    } else {
        notaMinimo.className = 'text-success font-weight-bold transition-all';
        notaMinimo.innerHTML = `<i class="fas fa-check-circle mr-1"></i> ¡Cumples con el monto mínimo de compra!`;
    }
}


async function renderizarCarrito() {
    const loadingInicial = document.getElementById('loadingInicial');
    const tarjetaCarrito = document.getElementById('tarjetaCarrito');
    const listaEl = document.getElementById('listaCarrito');
    const contenedorVacio = document.getElementById('contenedorVacio');
    const contenedorLista = document.getElementById('contenedorLista');
    const footerCarrito = document.getElementById('footerCarrito');
    const badgeTotal = document.getElementById('badgeTotalItems');
    const lblMontoTotal = document.getElementById('lblMontoTotal');
    const alertaGlobal = document.getElementById('alertaGlobalStock');

    const carrito = obtenerCarrito();

    // 1. Caso Carrito Vacío
    if (carrito.length === 0) {
        contenedorVacio.classList.remove('d-none');
        contenedorLista.classList.add('d-none');
        footerCarrito.classList.add('d-none');
        alertaGlobal.classList.add('d-none');
        badgeTotal.textContent = '0 artículos';
        actualizarBadgeCarrito();

        // Ocultar spinner inicial y mostrar la tarjeta directa
        if (loadingInicial) loadingInicial.classList.add('d-none');
        if (tarjetaCarrito) tarjetaCarrito.classList.remove('d-none');
        return;
    }

    // 2. Caso Carrito con Productos
    contenedorVacio.classList.add('d-none');
    contenedorLista.classList.remove('d-none');
    footerCarrito.classList.remove('d-none');

    // Mostrar la estructura base e inyectamos el loader de verificación de stock
    if (loadingInicial) loadingInicial.classList.add('d-none');
    if (tarjetaCarrito) tarjetaCarrito.classList.remove('d-none');

    listaEl.innerHTML = `
        <li class="list-group-item text-center py-4 border-0">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mb-0 mt-2 text-muted small">Verificando disponibilidad de productos...</p>
        </li>
    `;

    // Consultar stock en Firebase
    const promesasStock = carrito.map(async (item) => {
        try {
            const docRef = doc(db, 'Producto', item.id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { ...item, stockRealBD: docSnap.data().cantidad || 0, existe: true };
            } else {
                return { ...item, stockRealBD: 0, existe: false };
            }
        } catch (e) {
            console.error("Error consultando stock del producto:", item.id, e);
            return { ...item, stockRealBD: item.stockMax || 0, existe: true };
        }
    });

    const productosVerificados = await Promise.all(promesasStock);

    let html = '';
    let montoTotal = 0;
    let hayErroresStock = false;
    let totalPiezas = 0;

    productosVerificados.forEach((prod, index) => {
        const subtotal = prod.precio * prod.cantidad;
        montoTotal += subtotal;
        totalPiezas += prod.cantidad;

        const stockActual = prod.stockRealBD;
        let mensajeError = '';
        let esInvalido = false;

        if (!prod.existe) {
            mensajeError = 'Este producto ya no se encuentra disponible en nuestro catálogo. Por favor, elimínalo.';
            esInvalido = true;
        } else if (stockActual === 0) {
            mensajeError = 'Agotado. Ya no contamos con piezas disponibles de este producto. Por favor, quítalo de tu lista.';
            esInvalido = true;
        } else if (prod.cantidad > stockActual) {
            mensajeError = `Solicitaste ${prod.cantidad} unidad(es), pero actualmente solo nos quedan ${stockActual} disponible(s). Por favor reduce la cantidad.`;
            esInvalido = true;
        }

        if (esInvalido) hayErroresStock = true;

        html += `
            <li class="list-group-item py-2 py-md-3 ${esInvalido ? 'item-out-of-stock' : ''}">
                <div class="row align-items-center">
                    <!-- Número (Oculto en móviles con d-none d-md-block) -->
                    <div class="col-1 text-center font-weight-bold text-muted d-none d-md-block">
                        ${index + 1}
                    </div>

                    <!-- Columna Producto (Ajustada a col-12 en móviles para evitar desfases) -->
                    <div class="col-12 col-md-5 d-flex align-items-center mb-2 mb-md-0">
                        <img src="${prod.imagenUrl || 'https://via.placeholder.com/70'}" alt="${prod.nombreProducto}" class="cart-item-img shadow-sm mr-2 mr-md-3">
                        <div class="lh-condensed">
                            <h6 class="mb-0 font-weight-bold text-dark small-md">${prod.nombreProducto}</h6>
                            <span class="small text-muted d-block" style="font-size: 13px;">P. Unitario: $${Number(prod.precio).toFixed(2)}</span>
                        </div>
                    </div>

                    <!-- Columna Cantidad (+ / -) -->
                    <div class="col-6 col-md-3 d-flex align-items-center justify-content-start justify-content-md-center">
                        <button class="btn btn-outline-secondary btn-sm btn-decrementar px-2 py-0" data-id="${prod.id}" data-cant="${prod.cantidad}">
                            <i class="fas fa-minus small"></i>
                        </button>
                        <input type="text" class="form-control form-control-sm mx-1 input-cant-cart font-weight-bold px-1" value="${prod.cantidad}" readonly>
                        <button class="btn btn-outline-secondary btn-sm btn-incrementar px-2 py-0" data-id="${prod.id}" data-cant="${prod.cantidad}" data-stock="${stockActual}">
                            <i class="fas fa-plus small"></i>
                        </button>
                    </div>

                    <!-- Columna Subtotal -->
                    <div class="col-4 col-md-2 text-right">
                        <span class="font-weight-bold text-dark d-block" style="font-size: 0.95rem;">$${subtotal.toFixed(2)}</span>
                    </div>

                    <!-- Columna Quitar -->
                    <div class="col-2 col-md-1 text-center">
                        <button class="btn btn-outline-danger btn-sm border-0 btn-eliminar p-1" data-id="${prod.id}" title="Eliminar producto">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>

                ${mensajeError ? `
                    <div class="row mt-1">
                        <div class="col-12 col-md-11 offset-md-1">
                            <small class="text-danger font-weight-bold" style="font-size: 12px;">
                                <i class="fas fa-exclamation-circle mr-1"></i> ${mensajeError}
                            </small>
                        </div>
                    </div>
                ` : ''}
            </li>
        `;
    });

    listaEl.innerHTML = html;
    badgeTotal.textContent = `${totalPiezas} artículo(s)`;
    lblMontoTotal.textContent = `$${montoTotal.toFixed(2)}`;

    //Actualizar estado de la nota
    actualizarNotaMontoMinimo(montoTotal);

    if (hayErroresStock) {
        alertaGlobal.classList.remove('d-none');
        alertaGlobal.classList.add('d-flex');
    } else {
        alertaGlobal.classList.add('d-none');
        alertaGlobal.classList.remove('d-flex');
    }

    actualizarBadgeCarrito();
    configurarEventosLista();
}

function configurarEventosLista() {
    document.querySelectorAll('.btn-incrementar').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const cantActual = parseInt(btn.dataset.cant);
            const stockMax = parseInt(btn.dataset.stock);
            const limiteMax = Math.min(2, stockMax);

            if (cantActual < limiteMax) {
                actualizarCantidadCarrito(id, cantActual + 1);
                renderizarCarrito();
            } else {
                if (cantActual >= 2) {
                    mostrarToast('El límite máximo es de 2 piezas por producto.', 'warning');
                } else {
                    mostrarToast(`Solo contamos con ${stockMax} pieza(s) disponible(s) en inventario.`, 'warning');
                }
            }
        });
    });

    document.querySelectorAll('.btn-decrementar').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const cantActual = parseInt(btn.dataset.cant);

            if (cantActual > 1) {
                actualizarCantidadCarrito(id, cantActual - 1);
                renderizarCarrito();
            } else {
                mostrarToast('La cantidad mínima es 1. Para eliminarlo usa el ícono de basura.', 'info');
            }
        });
    });

    document.querySelectorAll('.btn-eliminar').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            actualizarCantidadCarrito(id, 0);
            mostrarToast('Producto eliminado del carrito.', 'info');
            renderizarCarrito();
        });
    });
}

async function manejarVaciarCarrito() {
    const confirmado = await mostrarConfirmacion({
        titulo: 'Vaciar carrito',
        mensaje: '¿Estás seguro de que deseas eliminar todos los productos de tu carrito?',
        btnAceptarText: 'Sí, vaciar',
        btnCancelarText: 'Cancelar',
        btnAceptarClass: 'btn-danger'
    });

    if (confirmado) {
        vaciarCarrito();
        mostrarToast('Carrito vaciado correctamente.', 'info');
        renderizarCarrito();
    }
}

async function manejarContinuarPedido() {
    const btnContinuar = document.getElementById('btnContinuarPedido');
    const notaMinimo = document.getElementById('notaMontoMinimo');
    
    //Obtener total actual del label o recalcular
    const lblMontoTotal = document.getElementById('lblMontoTotal');
    const totalActual = parseFloat(lblMontoTotal?.textContent.replace('$', '') || '0');

    //1. Validación del monto mínimo ($100)
    if (totalActual < 100) {
        const faltante = (100 - totalActual).toFixed(2);

        //Rematar con Toast informativo
        mostrarToast(`El monto mínimo de compra es de $100.00. Te faltan $${faltante} para continuar.`, 'warning');

        //Transformar la notita gris a ROJA llamativa con animación
        if (notaMinimo) {
            notaMinimo.className = 'text-danger font-weight-bold transition-all p-1 bg-white rounded border border-danger d-inline-block shake-alert';
            notaMinimo.innerHTML = `<i class="fas fa-exclamation-triangle mr-1"></i> ¡Atención! Requiere un mínimo de $100.00 (Faltan $${faltante})`;

            //Quitar el efecto de shake después de completarse la animación
            setTimeout(() => {
                notaMinimo.classList.remove('shake-alert');
            }, 500);
        }
        return; //Detener el flujo si no cumple el mínimo
    }

    //2. Continuar la validación del stock, por si hubo cambios antes de procesar su pedido
    if (btnContinuar) {
        btnContinuar.disabled = true;
        btnContinuar.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Validando stock...';
    }

    try {
        await renderizarCarrito();

        const hayInconsistencia = document.querySelectorAll('.item-out-of-stock').length > 0;

        if (hayInconsistencia) {
            mostrarToast('El stock de algunos productos cambió. Por favor ajusta o elimina los marcados en rojo antes de continuar.', 'warning');
            return;
        }

        window.location.href = 'confirmaPedido.html';

    } catch (error) {
        console.error("Error al validar stock antes de continuar:", error);
        mostrarToast('Ocurrió un error al verificar la disponibilidad. Inténtalo de nuevo.', 'danger');
    } finally {
        if (btnContinuar) {
            btnContinuar.disabled = false;
            btnContinuar.innerHTML = 'Continuar pedido <i class="fas fa-arrow-right ml-1"></i>';
        }
    }
}