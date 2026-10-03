// js/firebase-categoria.js
import { db } from './firebase-config.js';
import { collection, addDoc, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('formCategoria');
    const inputNombre = document.getElementById('nombreCategoria');
    const tituloHeader = document.querySelector('.card-header h5');
    
    if (!form) return;

    //Obtener ID guardado en sessionStorage (si existe)
    const categoriaId = sessionStorage.getItem('editarCategoriaId');

    //Modo edición: Si hay un ID presente
    if (categoriaId) {
        if (tituloHeader) tituloHeader.innerText = 'Editar Categoría';

        try {
            const docRef = doc(db, 'Categoria', categoriaId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                inputNombre.value = docSnap.data().nombreCategoria || '';
            } else {
                alert('La categoría seleccionada no existe.');
                sessionStorage.removeItem('editarCategoriaId');
                window.location.href = 'panelCategoria.html';
                return;
            }
        } catch (error) {
            console.error('Error al cargar la categoría:', error);
            alert('Error al consultar el registro.');
        }
    }

    // Si el usuario cancela o sale, eliminamos la clave de sessionStorage
    const btnCancelar = form.querySelector('a[href="panelCategoria.html"]');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            sessionStorage.removeItem('editarCategoriaId');
        });
    }

    //Guardado (Crear o Actualizar)
    form.addEventListener('submit', async (event) => {
        if (form.checkValidity() === false) {
            event.preventDefault();
            event.stopPropagation();
            form.classList.add('was-validated');
            return;
        }

        event.preventDefault();
        form.classList.add('was-validated');

        const nombreValor = inputNombre.value.trim();
        const btnGuardar = form.querySelector('button[type="submit"]');
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';

        try {
            if (categoriaId) {
                // Actualizar documento existente
                const docRef = doc(db, 'Categoria', categoriaId);
                await updateDoc(docRef, {
                    nombreCategoria: nombreValor
                });
                console.log('Categoría actualizada con éxito.');
                sessionStorage.removeItem('editarCategoriaId'); // Limpiar sesión
            } else {
                // Crear nuevo documento
                const docRef = await addDoc(collection(db, 'Categoria'), {
                    nombreCategoria: nombreValor,
                    status: 1
                });
                console.log('Categoría creada con ID:', docRef.id);
            }

            window.location.href = 'panelCategoria.html';

        } catch (error) {
            console.error('Error al procesar la solicitud en Firebase:', error);
            alert('Ocurrió un error al guardar los cambios.');
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar';
        }
    });
});