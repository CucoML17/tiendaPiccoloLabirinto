// js/firebase-producto.js
import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    doc, 
    getDoc, 
    updateDoc, 
    query, 
    where, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { mostrarToast } from './toast.js';

//Configuración de CLOUDINARY
const CLOUDINARY_CLOUD_NAME = 'ehjqcucc';
const CLOUDINARY_UPLOAD_PRESET = 'productos';

document.addEventListener('DOMContentLoaded', async () => {
    //Cargar selects al iniciar
    await cargarCategorias();
    await cargarNiveles();

    const form = document.getElementById('formProducto');
    if (!form) return;

    //Referencias al DOM
    const inputNombre = document.getElementById('nombreProducto');
    const inputDescripcion = document.getElementById('descripcionProducto');
    const inputCantidad = document.getElementById('cantidadProducto');
    const inputPrecio = document.getElementById('precioProducto');
    const selectCategoria = document.getElementById('categoriaProducto');
    const selectNivel = document.getElementById('nivelProducto');
    const inputImagen = document.getElementById('imagenProducto');
    const labelImagen = document.getElementById('labelImagen');
    
    //Referencias múltiples para responsive (móvil / desktop)
    const imgPreviews = document.querySelectorAll('.img-preview-element');
    const previewPlaceholders = document.querySelectorAll('.img-preview-placeholder');
    const tituloHeader = document.getElementById('formTitle');

    //Obtener ID para Modo Edición
    const productoId = sessionStorage.getItem('editarProductoId');

    //Modo edición: Cargar datos existentes
    if (productoId) {
        if (tituloHeader) tituloHeader.innerText = 'Editar Producto';

        try {
            const docRef = doc(db, 'Producto', productoId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                inputNombre.value = data.nombreProducto || '';
                inputDescripcion.value = data.descripcion || '';
                inputCantidad.value = data.cantidad !== undefined ? data.cantidad : '';
                inputPrecio.value = data.precio !== undefined ? data.precio : '';
                selectCategoria.value = data.idCategoria || '';
                selectNivel.value = data.idNivel || '';

                //En edición, la imagen no es estrictamente obligatoria si ya tiene una
                if (inputImagen) {
                    inputImagen.removeAttribute('required');
                }

                //Precargar vista previa de imagen en edición
                const urlImg = data.imagenUrl || data.imageUrl;
                if (urlImg) {
                    imgPreviews.forEach(img => {
                        img.src = urlImg;
                        img.style.display = 'block';
                    });
                    previewPlaceholders.forEach(placeholder => {
                        placeholder.style.display = 'none';
                    });
                    if (labelImagen) labelImagen.innerText = 'Cambiar imagen (opcional)...';
                }
            } else {
                mostrarToast('El producto seleccionado ya no existe.', 'warning');
                sessionStorage.removeItem('editarProductoId');
                setTimeout(() => window.location.href = 'panelProductos.html', 1500);
                return;
            }
        } catch (error) {
            console.error('Error al cargar producto:', error);
            mostrarToast('Error al consultar el registro.', 'danger');
        }
    }

    //Cancelar edición
    const btnCancelar = form.querySelector('a[href="panelProductos.html"]');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            sessionStorage.removeItem('editarProductoId');
        });
    }

    //Submit o envío del formulario
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const archivoImagen = inputImagen.files[0];

        //Validar tipo de archivo si fue seleccionado
        if (archivoImagen && !archivoImagen.type.startsWith('image/')) {
            inputImagen.setCustomValidity('El archivo debe ser una imagen válida.');
        } else {
            inputImagen.setCustomValidity('');
        }

        //Revisar si el formulario cumple todas las validaciones HTML5 / Bootstrap
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            // Hacer foco en el primer campo inválido
            const primerInvalido = form.querySelector(':invalid');
            if (primerInvalido) primerInvalido.focus();
            return;
        }

        form.classList.add('was-validated');

        const btnGuardar = form.querySelector('button[type="submit"]');
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';

        try {
            let urlImagenDescarga = "";

            //Subir imagen a cloudinary
            if (archivoImagen) {
                btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Subiendo imagen...';
                urlImagenDescarga = await subirImagenCloudinary(archivoImagen);
            }

            //Mapeo de datos para Firestore
            const datosProducto = {
                nombreProducto: inputNombre.value.trim(),
                descripcion: inputDescripcion.value.trim() || "...",
                cantidad: parseInt(inputCantidad.value, 10),
                precio: parseFloat(inputPrecio.value),
                idCategoria: selectCategoria.value,
                idNivel: selectNivel.value
            };

            if (productoId) {
                //Modo editar
                if (urlImagenDescarga !== "") {
                    datosProducto.imagenUrl = urlImagenDescarga;
                }
                const docRef = doc(db, 'Producto', productoId);
                await updateDoc(docRef, datosProducto);
                sessionStorage.removeItem('editarProductoId');
                mostrarToast('Producto actualizado correctamente.', 'success');
            } else {
                //Modo crear
                datosProducto.imagenUrl = urlImagenDescarga;
                datosProducto.status = 1;
                await addDoc(collection(db, 'Producto'), datosProducto);
                mostrarToast('Producto registrado exitosamente.', 'success');
            }

            //Redireccionar al panel
            setTimeout(() => {
                window.location.href = 'panelProductos.html';
            }, 1000);

        } catch (error) {
            console.error('Error al guardar el producto:', error);
            mostrarToast('Error al guardar los cambios: ' + error.message, 'danger');
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar';
        }
    });
});

//Función auxiliar para enviar la imagen a Cloudinary mediante Fetch
async function subirImagenCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

    const respuesta = await fetch(url, {
        method: 'POST',
        body: formData
    });

    if (!respuesta.ok) {
        throw new Error('No se pudo subir la imagen a la nube.');
    }

    const data = await respuesta.json();
    return data.secure_url;
}

//Carga las categorías activas (status == 1)
async function cargarCategorias() {
    const selectCategoria = document.getElementById('categoriaProducto');
    if (!selectCategoria) return;

    try {
        const querySnapshot = await getDocs(query(collection(db, 'Categoria'), where('status', '==', 1)));
        selectCategoria.innerHTML = '<option value="" selected disabled>Seleccionar...</option>';
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const option = document.createElement('option');
            option.value = docSnap.id;
            option.textContent = data.nombreCategoria;
            selectCategoria.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar Categoria:", error);
    }
}

//Carga los niveles activos (status == 1)
async function cargarNiveles() {
    const selectNivel = document.getElementById('nivelProducto');
    if (!selectNivel) return;

    try {
        const querySnapshot = await getDocs(query(collection(db, 'Nivel'), where('status', '==', 1)));
        selectNivel.innerHTML = '<option value="" selected disabled>Seleccionar...</option>';
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const option = document.createElement('option');
            option.value = docSnap.id;
            option.textContent = data.nombreNivel;
            selectNivel.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar Nivel:", error);
    }
}