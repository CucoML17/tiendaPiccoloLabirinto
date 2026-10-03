// js/carrito.js
import { mostrarToast } from './toast.js';

const CARRITO_KEY = 'carrito_compras';

//Obtiene los elementos actuales del carrito desde localStorage
export function obtenerCarrito() {
    return JSON.parse(localStorage.getItem(CARRITO_KEY)) || [];
}

//Guarda el carrito en localStorage y dispara un evento personalizado
function guardarCarrito(carrito) {
    localStorage.setItem(CARRITO_KEY, JSON.stringify(carrito));
    //Evento para que otros componentes (ej. Header) sepan que cambió el carrito
    window.dispatchEvent(new Event('carritoActualizado'));
}

//Agrega un producto al carrito respetando stocks y límites
export function agregarAlCarrito(producto, cantidad) {
    let carrito = obtenerCarrito();
    const index = carrito.findIndex(item => item.id === producto.id);
    const cantidadAgregar = parseInt(cantidad) || 1;

    //Cantidad que el usuario YA tiene guardada en su carrito
    const cantidadEnCarrito = index !== -1 ? carrito[index].cantidad : 0;
    
    //Stock real proveniente de la BD (o del respaldo stockMax)
    const stockBD = producto.cantidad ?? producto.stockMax ?? 0;

    //Límite máximo global o por inventario existente
    const maxPermitido = Math.min(2, stockBD);

    //1. Si el usuario ya tiene en el carrito igual o más piezas de las que existen en stock/límite
    if (cantidadEnCarrito >= maxPermitido) {
        mostrarToast(
            `No es posible agregar más. Ya tienes ${cantidadEnCarrito} en tu carrito y el stock actual es de ${stockBD} pieza(s).`,
            'warning'
        );
        return false;
    }

    // 2. Si la suma total excede el inventario/límite disponible
    if (cantidadEnCarrito + cantidadAgregar > maxPermitido) {
        const disponiblesParaAgregar = maxPermitido - cantidadEnCarrito;
        
        // Verificamos cuál fue el motivo del límite (Si 2 era el máximo o si el stock real era menor a 2)
        const mensajeError = maxPermitido === 2 && stockBD >= 2
            ? `Solo puedes llevar un máximo de 2 piezas de este producto. Puedes agregar ${disponiblesParaAgregar} unidad(es) más.`
            : `Solo puedes agregar ${disponiblesParaAgregar} unidad(es) más para no superar el stock disponible (${stockBD}).`;

        mostrarToast(mensajeError, 'warning');
        return false;
    }

    //Si la validación pasa, guardamos
    if (index !== -1) {
        carrito[index].cantidad += cantidadAgregar;
    } else {
        carrito.push({
            id: producto.id,
            nombreProducto: producto.nombreProducto,
            precio: producto.precio,
            imagenUrl: producto.imagenUrl,
            cantidad: cantidadAgregar,
            stockMax: stockBD
        });
    }

    guardarCarrito(carrito);
    mostrarToast(`Se agregó "${producto.nombreProducto}" al carrito.`, 'success');
    return true;
}

//Obtiene el total de ítems guardados en el carrito
export function obtenerTotalItemsCarrito() {
    const carrito = obtenerCarrito();
    return carrito.reduce((acc, item) => acc + item.cantidad, 0);
}

//Actualiza la cantidad de un producto específico en el carrito o lo elimina si es 0
export function actualizarCantidadCarrito(idProducto, nuevaCantidad) {
    let carrito = obtenerCarrito();
    const index = carrito.findIndex(item => item.id === idProducto);

    if (index === -1) return;

    if (nuevaCantidad <= 0) {
        carrito.splice(index, 1);
    } else {
        carrito[index].cantidad = nuevaCantidad;
    }

    guardarCarrito(carrito);
}

//Vacía completamente el carrito de compras
export function vaciarCarrito() {
    localStorage.removeItem(CARRITO_KEY);
    window.dispatchEvent(new Event('carritoActualizado'));
}