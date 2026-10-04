//js/confirma-pedido-js.js
import { obtenerCarrito, vaciarCarrito, obtenerTotalItemsCarrito } from './carrito.js';
import { mostrarConfirmacion } from './modal-confirm.js';
import { mostrarToast } from './toast.js';
import { db } from './firebase-config.js';
import { 
    collection, 
    doc, 
    getDoc, 
    runTransaction,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initHeader } from './header-externo.js';

import { obtenerOcrearIdCliente, obtenerIpPublica } from './utils-dispositivo.js';

import { actualizarBadgePedidosCliente, buscarYVincularPedidoPorTelefono } from './utils-pedidos-cliente.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargar el header externo
    await cargarHeader();

    // 2. Verificar que el carrito no esté vacío
    const carrito = obtenerCarrito();
    if (carrito.length === 0) {
        mostrarToast('Tu carrito está vacío. Serás redirigido al catálogo.', 'warning');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        return;
    }

    // 3. Inicializar límites de fecha, hora y badge
    configurarLimitesFechaYHora();
    actualizarMontoResumen(carrito);

    // 4. Configurar listener del formulario
    const form = document.getElementById('formConfirmaPedido');
    if (form) {
        form.addEventListener('submit', manejarConfirmacionPedido);
    }
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

//Calcula y muestra el monto total acumulado en el badge de la tarjeta.
function actualizarMontoResumen(carrito) {
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const badge = document.getElementById('badgeResumenMonto');
    if (badge) {
        badge.textContent = `Total: $${total.toFixed(2)}`;
    }
}


function configurarLimitesFechaYHora() {
    const inputFecha = document.getElementById('fechaEntrega');
    const inputHora = document.getElementById('horaEntrega');

    const ahora = new Date();
    const horaCierre = 18;
    const minutoCierre = 30;

    let fechaMinima = new Date(ahora);

    // Si la hora actual supera las 18:30, pasamos al día siguiente
    const minutosHoraActual = ahora.getHours() * 60 + ahora.getMinutes();
    const minutosHoraCierre = horaCierre * 60 + minutoCierre;

    if (minutosHoraActual >= minutosHoraCierre) {
        fechaMinima.setDate(fechaMinima.getDate() + 1);
    }

    // Si la fecha inicial cae en Jueves (4) o Viernes (5), avanzamos hasta el Sábado (6)
    while (fechaMinima.getDay() === 4 || fechaMinima.getDay() === 5) {
        fechaMinima.setDate(fechaMinima.getDate() + 1);
    }

    // límite máximo avanzando 3 días válidos de entrega (brincando Jueves y Viernes)
    let fechaMaxima = new Date(fechaMinima);
    let diasValidosSumados = 0;

    while (diasValidosSumados < 3) {
        fechaMaxima.setDate(fechaMaxima.getDate() + 1);
        //  cuenta como día de rango si NO es Jueves (4) ni Viernes (5)
        if (fechaMaxima.getDay() !== 4 && fechaMaxima.getDay() !== 5) {
            diasValidosSumados++;
        }
    }

    const formatInputDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    if (inputFecha) {
        inputFecha.min = formatInputDate(fechaMinima);
        inputFecha.max = formatInputDate(fechaMaxima);

        //Valor actual está fuera de rango o es un día prohibido (Jueves/Viernes), lo ajustamos al mínimo
        if (!inputFecha.value || inputFecha.value < inputFecha.min || inputFecha.value > inputFecha.max) {
            inputFecha.value = inputFecha.min;
        } else {
            const [y, m, d] = inputFecha.value.split('-').map(Number);
            const diaSemana = new Date(y, m - 1, d).getDay();
            if (diaSemana === 4 || diaSemana === 5) {
                inputFecha.value = inputFecha.min;
            }
        }
    }

    // Configuración de horas
    if (inputHora) {
        inputHora.min = '17:00';
        inputHora.max = '18:30';
        inputHora.step = '60';
        
        if (!inputHora.value) {
            inputHora.value = '17:00';
        }
    }
}
//Convierte un string de fecha (YYYY-MM-DD) a formato DD/MM/YYYY
function formatearFechaDDMMYYYY(fechaStr) {
    const partes = fechaStr.split('-');
    if (partes.length !== 3) return fechaStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// Deshabilita o habilita todos los controles interactivos del formulario.
function bloquearFormulario(bloquear = true) {
    const form = document.getElementById('formConfirmaPedido');
    if (!form) return;

    const elementos = form.querySelectorAll('input, button, select, textarea');
    elementos.forEach(el => {
        el.disabled = bloquear;
    });
}



// Función auxiliar para notificar al Administrador vía EmailJS
async function enviarNotificacionAdmin(datosPedido, itemsCarrito) {
    try {
        const resumenProductos = itemsCarrito
            .map(item => `- ${item.nombreProducto} x${item.cantidad} ($${(item.precio * item.cantidad).toFixed(2)})`)
            .join('\n');

        const templateParams = {
            cliente_nombre: datosPedido.nombrePide,
            cliente_telefono: datosPedido.telefono,
            fecha_entrega: datosPedido.fechaPedido,
            hora_entrega: datosPedido.horaPedido,
            total_pagar: `$${datosPedido.totPagar.toFixed(2)}`,
            detalles_productos: resumenProductos,
            id_pedido: datosPedido.id,
            
            link_panel_admin: 'https://cucoml17.github.io/tiendaPiccoloLabirinto/panelPedidosPendientes.html'
        };

        await emailjs.send('service_p220r0m', 'template_pcavfrk', templateParams, 'AL9drILDhYzYCId17');
        console.log('Notificación por correo enviada al administrador.');
    } catch (err) {
        console.error('Error enviando notificación al admin:', err);
    }
}

//Procesa la validación del formulario y realiza la transacción en Firebase
async function manejarConfirmacionPedido(e) {
    e.preventDefault();
    e.stopPropagation();

    const form = e.target;
    const inputNombre = document.getElementById('nombreCliente');
    const inputTelefono = document.getElementById('telefonoCliente');
    const inputFecha = document.getElementById('fechaEntrega');
    const inputHora = document.getElementById('horaEntrega');

    // Expresiones regulares
    const regexNombre = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s.]+$/;
    const regexTelefono = /^[0-9]{10}$/;

    let esValido = true;

    // Reiniciar validaciones personalizadas
    inputNombre.setCustomValidity('');
    inputTelefono.setCustomValidity('');
    inputFecha.setCustomValidity('');
    inputHora.setCustomValidity('');

    // Validar Nombre
    if (!inputNombre.value.trim() || !regexNombre.test(inputNombre.value.trim())) {
        inputNombre.setCustomValidity('Nombre inválido');
        esValido = false;
    }

    // Validar Teléfono
    if (!inputTelefono.value.trim() || !regexTelefono.test(inputTelefono.value.trim())) {
        inputTelefono.setCustomValidity('Teléfono inválido');
        esValido = false;
    }

    // Validar Fecha
    if (!inputFecha.value) {
        inputFecha.setCustomValidity('Fecha requerida');
        esValido = false;
    } else {
        const [year, month, day] = inputFecha.value.split('-').map(Number);
        const fechaSelec = new Date(year, month - 1, day);
        const diaSemana = fechaSelec.getDay(); // 0: Dom, 1: Lun, ... 4: Jue, 5: Vie

        // 1. Validar que no sea Jueves (4) ni Viernes (5)
        if (diaSemana === 4 || diaSemana === 5) {
            inputFecha.setCustomValidity('No realizamos entregas los días jueves ni viernes.');
            esValido = false;
        } else {
            // 2. Validar que la fecha esté dentro de los límites del input
            const minFecha = new Date(inputFecha.min + 'T00:00:00');
            const maxFecha = new Date(inputFecha.max + 'T23:59:59');

            if (fechaSelec < minFecha || fechaSelec > maxFecha) {
                inputFecha.setCustomValidity('Fecha fuera del rango de entrega permitido.');
                esValido = false;
            }
        }
    }

    // Validar Hora
    if (!inputHora.value) {
        inputHora.setCustomValidity('Hora requerida');
        esValido = false;
    } else {
        const partesHora = inputHora.value.split(':');
        const horas = parseInt(partesHora[0], 10);
        const minutos = parseInt(partesHora[1], 10);

        if (isNaN(horas) || isNaN(minutos)) {
            inputHora.setCustomValidity('Formato de hora inválido');
            esValido = false;
        } else {
            const minutosTotales = horas * 60 + minutos;
            const minPermitido = 17 * 60;        // 17:00 (1020 mins)
            const maxPermitido = 18 * 60 + 30;   // 18:30 (1110 mins)

            if (minutosTotales < minPermitido || minutosTotales > maxPermitido) {
                inputHora.setCustomValidity('Hora fuera de rango (17:00 - 18:30)');
                esValido = false;
            }
        }
    }

    form.classList.add('was-validated');

    if (!esValido || !form.checkValidity()) {
        mostrarToast('Por favor completa los datos marcados correctamente.', 'warning');
        return;
    }

    //Protección anti-spam y recuperación del pedido
    
    //1. Revisar en localStorage local
    const pedidosActivosLocal = await actualizarBadgePedidosCliente();
    if (pedidosActivosLocal >= 1) {
        mostrarToast('Ya tienes un pedido activo en proceso. Redirigiendo...', 'warning');
        setTimeout(() => { window.location.href = 'misPedidos.html'; }, 2000);
        return;
    }

    //2. Revisar por Teléfono en la BD (Recupera idCliente si el usuario borró datos / usa incógnito)
    const telIngresado = inputTelefono.value.trim();
    const pedidoRecuperado = await buscarYVincularPedidoPorTelefono(telIngresado);

    if (pedidoRecuperado) {
        mostrarToast('Hemos detectado un pedido activo asociado a este teléfono. Re-vinculando tu sesión...', 'info');
        
        // Esperamos brevemente para que el usuario lea el Toast y lo enviamos a ver su pedido
        setTimeout(() => {
            window.location.href = 'misPedidos.html';
        }, 2200);
        return;
    }
    // ---------------------------------------------------
    // --


    //Modal de confirmación
    const confirmado = await mostrarConfirmacion({
        titulo: 'Confirmar Pedido',
        mensaje: '¿Estás seguro de que deseas registrar tu pedido con los datos ingresados?',
        btnAceptarText: 'Sí, confirmar',
        btnCancelarText: 'Revisar datos',
        btnAceptarClass: 'btn-success'
    });

    if (!confirmado) return;

    //Obtener datos de trazabilidad
    const ipPublica = await obtenerIpPublica();
    const idCliente = obtenerOcrearIdCliente();

    //Bloqueo inmediato del formulario
    bloquearFormulario(true);

    const btnSubmit = document.getElementById('btnConfirmarPedido');
    if (btnSubmit) {
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Procesando pedido...';
    }

try {
        const carrito = obtenerCarrito();
        
        // 1. Preparamos la referencia del nuevo pedido y los datos ANTES o FUERA de la transacción
        const nuevoPedidoRef = doc(collection(db, 'Pedido'));
        const totalPagar = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

        const datosPedido = {
            nombrePide: inputNombre.value.trim(),
            telefono: inputTelefono.value.trim(),
            fechaPedido: formatearFechaDDMMYYYY(inputFecha.value),
            horaPedido: inputHora.value,
            totPagar: Number(totalPagar.toFixed(2)),
            status: 1, //1: Activo / Registrado

            ip: ipPublica,
            idCliente: idCliente,
            fechaCreacion: serverTimestamp()
        };

        //2. Ejecutamos la Transacción Firestore
        await runTransaction(db, async (transaction) => {
            // Verificación previa de stock
            const verificaciones = [];
            for (const item of carrito) {
                const prodRef = doc(db, 'Producto', item.id);
                const prodDoc = await transaction.get(prodRef);

                if (!prodDoc.exists()) {
                    throw new Error(`El producto "${item.nombreProducto}" ya no existe en el catálogo.`);
                }

                const stockActual = prodDoc.data().cantidad || 0;
                if (stockActual < item.cantidad) {
                    throw new Error(`El producto "${item.nombreProducto}" solo cuenta con ${stockActual} piezas disponibles.`);
                }

                verificaciones.push({
                    ref: prodRef,
                    nuevoStock: stockActual - item.cantidad
                });
            }

            //Crear el Pedido y sus DetallePedido
            transaction.set(nuevoPedidoRef, datosPedido);

            carrito.forEach(item => {
                const detalleRef = doc(collection(db, 'DetallePedido'));
                transaction.set(detalleRef, {
                    idPedido: nuevoPedidoRef.id,
                    idProducto: item.id,
                    cantidad: Number(item.cantidad)
                });
            });

            //Actualizar las existencias en Firestore
            verificaciones.forEach(item => {
                transaction.update(item.ref, { cantidad: item.nuevoStock });
            });
        });

        //3. Ahora que la transacción terminó con éxito, las variables SÍ existen en este ámbito
        enviarNotificacionAdmin({ ...datosPedido, id: nuevoPedidoRef.id }, carrito);        

        //4. Operación exitosa: Vaciar carrito y notificar
        vaciarCarrito();
        mostrarToast('¡Tu pedido ha sido registrado con éxito!', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);

    } catch (error) {
        console.error('Error al guardar el pedido:', error);
        mostrarToast(error.message || 'Ocurrió un error al procesar el pedido.', 'danger');
        
        bloquearFormulario(false);
        if (btnSubmit) {
            btnSubmit.innerHTML = '<i class="fas fa-check-circle mr-1"></i> Confirmar pedido';
        }

        setTimeout(() => {
            window.location.href = 'carritoCompras.html';
        }, 2500);
    }
}