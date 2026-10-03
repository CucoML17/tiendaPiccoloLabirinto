// js/utils-pedidos-cliente.js
import { db } from './firebase-config.js';
import { 
    collection, 
    query, 
    where, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { obtenerOcrearIdCliente, guardarIdCliente } from './utils-dispositivo.js';


 //Consulta en Firestore si el cliente tiene pedidos en estado activo (status == 1)
 //y actualiza el badge en el Header (#badgeMisCompras).

export async function actualizarBadgePedidosCliente() {
    const idCliente = obtenerOcrearIdCliente();
    if (!idCliente) return 0;

    try {
        const q = query(
            collection(db, 'Pedido'),
            where('idCliente', '==', idCliente),
            where('status', '==', 1)
        );

        const querySnapshot = await getDocs(q);
        const totalPedidosActivos = querySnapshot.size;

        const badge = document.getElementById('badgeMisCompras');
        if (badge) {
            if (totalPedidosActivos > 0) {
                badge.textContent = totalPedidosActivos;
                badge.classList.remove('d-none');
            } else {
                badge.classList.add('d-none');
            }
        }

        return totalPedidosActivos;
    } catch (error) {
        console.error('Error al verificar pedidos activos del cliente:', error);
        return 0;
    }
}


//Consulta si ya existe un pedido activo por número de teléfono.
//Si existe, recobra el 'idCliente' original y lo vuelve a vincular en localStorage,
//actualizando también el badge en el Header.
 
export async function buscarYVincularPedidoPorTelefono(telefono) {
    if (!telefono) return false;
    try {
        const qTel = query(
            collection(db, 'Pedido'),
            where('telefono', '==', telefono.trim()),
            where('status', '==', 1)
        );
        const querySnapshot = await getDocs(qTel);

        if (!querySnapshot.empty) {
            // Tomar el primer pedido activo encontrado
            const docPedido = querySnapshot.docs[0].data();
            
            // Si el pedido tiene un idCliente asociado, lo re-vincula al navegador actual
            if (docPedido.idCliente) {
                guardarIdCliente(docPedido.idCliente);
                
                //Actualizar inmediatamente el Badge en el Header para reflejar la recuperación
                await actualizarBadgePedidosCliente();
            }
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error al verificar y vincular pedido por teléfono:', error);
        return false;
    }
}