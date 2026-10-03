// js/firebase-nivel.js
import { db } from './firebase-config.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('formNivel');
    const inputNombre = document.getElementById('nombreNivel');
    const inputDificultad = document.getElementById('nivelDificultad');
    const feedbackDificultad = document.getElementById('feedbackDificultad');
    const colorPicker = document.getElementById('colorPicker');
    const colorSwatch = document.getElementById('colorSwatch');
    const previewTexto = document.getElementById('previewTexto');
    const tituloHeader = document.getElementById('tituloFormulario');
    
    if (!form) return;

    // Manejo de previsualización en tiempo real
    inputNombre.addEventListener('input', (e) => {
        const valor = e.target.value.trim();
        previewTexto.textContent = valor.length > 0 ? valor : 'Nombre del nivel';
    });

    colorPicker.addEventListener('input', (e) => {
        const colorHex = e.target.value;
        colorSwatch.style.backgroundColor = colorHex;
        previewTexto.style.color = colorHex;
    });

    // Limpiar mensaje de validación personalizado al escribir en el input de dificultad
    if (inputDificultad) {
        inputDificultad.addEventListener('input', () => {
            inputDificultad.setCustomValidity('');
            if (feedbackDificultad) {
                feedbackDificultad.textContent = 'Por favor ingresa un número entero entre 1 y 10.';
            }
        });
    }

    // Modo edición: Obtener ID guardado en sessionStorage
    const nivelId = sessionStorage.getItem('editarNivelId');

    if (nivelId) {
        if (tituloHeader) tituloHeader.innerText = 'Editar Nivel';

        try {
            const docRef = doc(db, 'Nivel', nivelId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const nombreVal = data.nombreNivel || '';
                const dificultadVal = data.nivelDificultad !== undefined ? data.nivelDificultad : '';
                
                // Formatear el color recuperado (si viene sin #, se lo concatenamos para el picker)
                let colorVal = data.color || '000000';
                if (!colorVal.startsWith('#')) {
                    colorVal = '#' + colorVal;
                }

                // Cargar datos en los inputs
                inputNombre.value = nombreVal;
                if (inputDificultad) inputDificultad.value = dificultadVal;
                colorPicker.value = colorVal;

                // Actualizar la previsualización
                previewTexto.textContent = nombreVal.length > 0 ? nombreVal : 'Nombre del nivel';
                colorSwatch.style.backgroundColor = colorVal;
                previewTexto.style.color = colorVal;

            } else {
                alert('El nivel seleccionado no existe.');
                sessionStorage.removeItem('editarNivelId');
                window.location.href = 'panelNiveles.html';
                return;
            }
        } catch (error) {
            console.error('Error al cargar el nivel:', error);
            alert('Error al consultar el registro.');
        }
    }

    // Limpieza al hacer clic en Cancelar
    const btnCancelar = form.querySelector('a[href="panelNiveles.html"]');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            sessionStorage.removeItem('editarNivelId');
        });
    }

    // Proceso de guardado (Crear o Actualizar)
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        // 1. Validaciones de rango (1 a 10)
        const dificultadNum = parseInt(inputDificultad.value, 10);
        
        if (isNaN(dificultadNum) || dificultadNum < 1 || dificultadNum > 10) {
            inputDificultad.setCustomValidity('Inválido');
            if (feedbackDificultad) {
                feedbackDificultad.textContent = 'El grado de dificultad debe ser un número entero entre 1 y 10.';
            }
        } else {
            inputDificultad.setCustomValidity('');
        }

        // Validaciones nativas HTML5
        if (form.checkValidity() === false) {
            event.stopPropagation();
            form.classList.add('was-validated');
            return;
        }

        const btnGuardar = form.querySelector('button[type="submit"]');
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Comprobando...';

        try {
            // 2. Comprobar duplicado en Firebase
            const q = query(collection(db, 'Nivel'), where("nivelDificultad", "==", dificultadNum));
            const querySnapshot = await getDocs(q);

            let existeDuplicado = false;
            querySnapshot.forEach((docSnap) => {
                // Si encontramos un documento con la misma dificultad y NO es el que estamos editando
                if (docSnap.id !== nivelId) {
                    existeDuplicado = true;
                }
            });

            if (existeDuplicado) {
                inputDificultad.setCustomValidity('Duplicado');
                if (feedbackDificultad) {
                    feedbackDificultad.textContent = `El grado de dificultad ${dificultadNum} ya está asignado a otro nivel.`;
                }
                form.classList.add('was-validated');
                btnGuardar.disabled = false;
                btnGuardar.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar';
                return;
            }

            // Preparamos datos a guardar
            btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';
            const nombreValor = inputNombre.value.trim();
            const colorValorHex = colorPicker.value.replace('#', '').toUpperCase();

            if (nivelId) {
                // Actualizar documento existente
                const docRef = doc(db, 'Nivel', nivelId);
                await updateDoc(docRef, {
                    nombreNivel: nombreValor,
                    nivelDificultad: dificultadNum,
                    color: colorValorHex
                });
                console.log('Nivel actualizado con éxito.');
                sessionStorage.removeItem('editarNivelId');
            } else {
                // Crear nuevo documento
                const docRef = await addDoc(collection(db, 'Nivel'), {
                    nombreNivel: nombreValor,
                    nivelDificultad: dificultadNum,
                    color: colorValorHex,
                    status: 1
                });
                console.log('Nivel creado con ID:', docRef.id);
            }

            window.location.href = 'panelNiveles.html';

        } catch (error) {
            console.error('Error al procesar la solicitud en Firebase:', error);
            alert('Ocurrió un error al guardar los cambios.');
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar';
        }
    });
});