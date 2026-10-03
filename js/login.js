// js/login.js
import { db } from './firebase-config.js';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { mostrarToast } from './toast.js';
import { encriptarContrasena } from './crypto-utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Si ya tiene sesión activa en localStorage, redirigir
    const sesionExistente = localStorage.getItem('admin_session');
    if (sesionExistente) {
        redirigirAUltimoDestino();
        return;
    }

    // 2. Listener para alternar la visibilidad de la contraseña
    const btnToggle = document.getElementById('btnTogglePassword');
    const inputPass = document.getElementById('contrasena');
    const iconEye = document.getElementById('iconEye');

    if (btnToggle && inputPass) {
        btnToggle.addEventListener('click', () => {
            const esPassword = inputPass.type === 'password';
            inputPass.type = esPassword ? 'text' : 'password';
            iconEye.className = esPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
        });
    }

    // 3. Listener del formulario
    const form = document.getElementById('formLogin');
    if (form) {
        form.addEventListener('submit', manejarLogin);
    }
});

async function manejarLogin(e) {
    e.preventDefault();

    const userInput = document.getElementById('username').value.trim();
    const passInput = document.getElementById('contrasena').value.trim();
    const btnSubmit = document.getElementById('btnIngresar');

    if (!userInput || !passInput) {
        mostrarToast('Ingresa usuario y contraseña', 'warning');
        return;
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Verificando...';
    }

    try {
        // 1. Buscar usuario por username
        const usuariosRef = collection(db, 'Usuario');
        const q = query(usuariosRef, where('username', '==', userInput));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            mostrarToast('Credenciales incorrectas', 'danger');
            restablecerBoton(btnSubmit);
            return;
        }

        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();

        // 2. Cifrar la contraseña ingresada
        const passHashIngresado = await encriptarContrasena(passInput);

        if (userData.contrasena !== passHashIngresado) {
            mostrarToast('Credenciales incorrectas', 'danger');
            restablecerBoton(btnSubmit);
            return;
        }

        // 3. Validar Estatus (1 = Activo)
        if (userData.status !== 1) {
            mostrarToast('Usuario inactivo. Contacta al administrador', 'danger');
            restablecerBoton(btnSubmit);
            return;
        }

        // 4. Validar Rol
        const rolRef = doc(db, 'Rol', userData.idRol);
        const rolSnap = await getDoc(rolRef);

        if (!rolSnap.exists() || rolSnap.data().nombreRol !== 'Administrador') {
            mostrarToast('Acceso denegado: No tienes permisos de administrador', 'danger');
            restablecerBoton(btnSubmit);
            return;
        }

        // 5. Guardar la Sesión en localStorage (persistente)
        const tokenPayload = {
            idUsuario: userDoc.id,
            nombre: userData.nombre,
            username: userData.username,
            rol: rolSnap.data().nombreRol,
            token: `token_${userDoc.id}_${Date.now()}`
        };

        localStorage.setItem('admin_session', JSON.stringify(tokenPayload));

        mostrarToast(`Bienvenido ${userData.nombre}`, 'success');

        setTimeout(() => {
            redirigirAUltimoDestino();
        }, 1000);

    } catch (error) {
        console.error('Error durante el inicio de sesión:', error);
        mostrarToast('Error al conectar con el servidor', 'danger');
        restablecerBoton(btnSubmit);
    }
}


 //Redirige al usuario a la página que intentó visitar antes del login,
 //o a 'panelProductos.html' por defecto.

function redirigirAUltimoDestino() {
    const destinoGuardado = localStorage.getItem('redirect_after_login');
    
    if (destinoGuardado) {
        localStorage.removeItem('redirect_after_login');
        window.location.href = destinoGuardado;
    } else {
        window.location.href = 'panelProductos.html';
    }
}

function restablecerBoton(btn) {
    if (!btn) return;
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i> Iniciar Sesión';
}