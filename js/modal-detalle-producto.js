// js/modal-detalle-producto.js
import { mostrarToast } from './toast.js';
import { agregarAlCarrito } from './carrito.js';
import { db } from './firebase-config.js'; // Importamos la conexión a Firebase
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"; // Importamos Firestore

//Importar la función correcta de utils-pedidos-cliente.js
import { actualizarBadgePedidosCliente } from './utils-pedidos-cliente.js';

let productoActual = null;

//Carga e inyecta la plantilla HTML del Modal en el DOM si no existe.
export async function inicializarModalDetalle() {
    if (document.getElementById('modalDetalleProducto')) return;

    try {
        const response = await fetch('modal-detalle-producto.html');
        const html = await response.text();
        document.body.insertAdjacentHTML('beforeend', html);
        configurarEventosModal();
    } catch (error) {
        console.error('Error al cargar la plantilla del modal:', error);
    }
}

//Registra los eventos internos del modal (Incremento/Decremento de cantidad y confirmación)
function configurarEventosModal() {
    const inputCant = document.getElementById('modalProductoCantidad');
    const btnDec = document.getElementById('btnDecrementarCant');
    const btnInc = document.getElementById('btnIncrementarCant');
    const btnConfirmar = document.getElementById('btnConfirmarAgregarCarrito');

    //Disminuir cantidad
    btnDec?.addEventListener('click', () => {
        let val = parseInt(inputCant.value) || 1;
        if (val > 1) {
            inputCant.value = val - 1;
        }
    });

    //Aumentar cantidad
    btnInc?.addEventListener('click', () => {
        let val = parseInt(inputCant.value) || 1;
        //Cambiamos el tope máximo fijo a 2
        const maxPermitido = Math.min(2, productoActual?.cantidad || 2);

        if (val < maxPermitido) {
            inputCant.value = val + 1;
        } else {
            //
            if (val >= 2) {
                mostrarToast('El límite máximo es de 2 piezas por producto.', 'warning');
            } else {
                mostrarToast(`Solo hay ${productoActual?.cantidad} piezas disponibles en stock.`, 'warning');
            }
        }
    });

    //Confirmar e incluir al carrito local
    btnConfirmar?.addEventListener('click', async () => {
        if (!productoActual) return;

        //Validar si ya cuenta con pedidos activos registrados
        try {
            const pedidosActivos = await actualizarBadgePedidosCliente();
            if (pedidosActivos >= 1) {
                mostrarToast('Ya tienes un pedido activo registrado. Si deseas realizar otro o modificar, cancela el anterior primero.', 'danger');
                return; 
            }
        } catch (error) {
            console.error("Error al validar pedidos activos:", error);
        }

        const cantidadSeleccionada = parseInt(inputCant.value) || 1;
        
        // Ejecutamos la adición al carrito
        const agregado = agregarAlCarrito(productoActual, cantidadSeleccionada);

        if (agregado) {
            // Cerrar el modal si se agregó con éxito
            $('#modalDetalleProducto').modal('hide');
        }
    });
}

//Abre el modal con la información MÁS RECIENTE del producto desde Firebase
export async function abrirModalDetalle(producto, nombreCategoria, nivelData) {
    if (!producto || !producto.id) return;

    try {
        //1. Consultar a Firebase para obtener los datos frescos en tiempo real
        const productoRef = doc(db, 'Producto', producto.id);
        const productoSnap = await getDoc(productoRef);

        if (productoSnap.exists()) {
            //Actualizamos la variable global con la información fresca de la BD
            productoActual = {
                id: productoSnap.id,
                ...productoSnap.data()
            };
        } else {
            mostrarToast('El producto ya no existe en el catálogo.', 'error');
            return;
        }
    } catch (error) {
        console.error("Error al consultar stock fresco en Firebase:", error);
        //Si la conexión falla, usamos el objeto local de respaldo
        productoActual = producto;
    }

    // 2. Elementos del DOM
    const imgEl = document.getElementById('modalProductoImagen');
    const catEl = document.getElementById('modalProductoCategoria');
    const nivEl = document.getElementById('modalProductoNivel');
    const nomEl = document.getElementById('modalProductoNombre');
    const preEl = document.getElementById('modalProductoPrecio');
    const descEl = document.getElementById('modalProductoDescripcion');
    const cantInput = document.getElementById('modalProductoCantidad');
    const stockEl = document.getElementById('modalProductoStock');

    if (!imgEl) return;

    //3. Rellenar datos usando productoActual (que ya viene fresco de la BD)
    imgEl.src = productoActual.imagenUrl || 'https://via.placeholder.com/300x200?text=Sin+Imagen';
    imgEl.alt = productoActual.nombreProducto || 'Producto';
    
    catEl.textContent = nombreCategoria || 'Sin Categoría';
    
    const hexColor = nivelData?.color ? (nivelData.color.startsWith('#') ? nivelData.color : `#${nivelData.color}`) : '#6c757d';
    nivEl.textContent = nivelData?.nombre || 'N/A';
    nivEl.style.backgroundColor = hexColor;

    nomEl.textContent = productoActual.nombreProducto || 'Producto sin nombre';
    preEl.textContent = `$${Number(productoActual.precio || 0).toFixed(2)}`;
    descEl.textContent = productoActual.descripcion || 'Sin descripción disponible para este producto.';
    
    //Resetear cantidad a 1
    cantInput.value = 1;
    
    if (stockEl) {
        stockEl.textContent = `Stock disponible: ${productoActual.cantidad || 0} piezas`;
    }

    //4. Mostrar el modal
    $('#modalDetalleProducto').modal('show');
}