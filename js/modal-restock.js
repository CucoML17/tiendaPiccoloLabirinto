// js/modal-restock.js

//Muestra un modal dinámico estilo Bootstrap para reabastecer stock de un producto.
export function mostrarModalRestock({ nombreProducto, stockActual = 0 }) {
    return new Promise((resolve) => {
        const idModal = 'modalRestockDinamico';
        
        //Eliminar modal previo si quedó alguno colgado en el DOM
        const modalPrevio = document.getElementById(idModal);
        if (modalPrevio) {
            modalPrevio.remove();
        }

        const htmlModal = `
            <div class="modal fade" id="${idModal}" tabindex="-1" role="dialog" aria-labelledby="${idModal}Label" aria-hidden="true" data-backdrop="static">
                <div class="modal-dialog modal-dialog-centered" role="document">
                    <div class="modal-content border-0 shadow">
                        
                        <div class="modal-header bg-light">
                            <h5 class="modal-title font-weight-bold text-dark" id="${idModal}Label">
                                Reabastecer Inventario
                            </h5>
                            <button type="button" class="close" data-dismiss="modal" aria-label="Cerrar">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>

                        <form id="formRestockModal" class="needs-validation" novalidate>
                            <div class="modal-body py-4">
                                <p class="mb-3">
                                    ¿Cuántas piezas nuevas deseas agregar a <strong>${nombreProducto}</strong>?
                                </p>
                                
                                <div class="alert alert-secondary py-2 px-3 small mb-3">
                                    <i class="fas fa-info-circle mr-1"></i> Stock actual registrado: <strong>${stockActual}</strong> unidades.
                                </div>

                                <div class="form-group mb-0">
                                    <label for="cantidadRestockInput" class="font-weight-bold small">
                                        Cantidad a sumar <span class="text-danger">*</span>
                                    </label>
                                    <div class="input-group has-validation">
                                        <div class="input-group-prepend">
                                            <span class="input-group-text bg-light"><i class="fas fa-plus text-muted"></i></span>
                                        </div>
                                        <input 
                                            type="number" 
                                            id="cantidadRestockInput" 
                                            class="form-control" 
                                            placeholder="Ej. 10" 
                                            min="1" 
                                            step="1" 
                                            required 
                                            autocomplete="off"
                                        >
                                        <div class="invalid-feedback">
                                            Ingresa una cantidad entera mayor a 0.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="modal-footer bg-light">
                                <button type="button" class="btn btn-admin-clear font-weight-bold px-4" data-dismiss="modal">
                                    <i class="fas fa-times mr-1"></i> Cancelar
                                </button>
                                <button type="submit" class="btn btn-dark font-weight-bold px-4" id="btnConfirmarRestock">
                                    <i class="fas fa-plus-circle mr-1"></i> Agregar
                                </button>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', htmlModal);

        const $modal = $(`#${idModal}`);
        const modalElement = document.getElementById(idModal);
        const form = document.getElementById('formRestockModal');
        const inputCantidad = document.getElementById('cantidadRestockInput');

        let confirmado = false;
        let cantidadIngresada = null;

        //Auto-enfocar el input al abrir el modal
        $modal.on('shown.bs.modal', () => {
            inputCantidad.focus();
        });

        //Evento Submit del Formulario
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!form.checkValidity()) {
                form.classList.add('was-validated');
                inputCantidad.focus();
                return;
            }

            form.classList.add('was-validated');
            confirmado = true;
            cantidadIngresada = parseInt(inputCantidad.value, 10);

            //Ocultar modal mediante la API de Bootstrap (jQuery)
            $modal.modal('hide');
        });

        //Cleanup al cerrar el modal (destrucción del DOM y resolución de la promesa)
        $modal.on('hidden.bs.modal', () => {
            modalElement.remove();
            if (confirmado && cantidadIngresada > 0) {
                resolve(cantidadIngresada);
            } else {
                resolve(null);
            }
        });

        //Mostrar el modal
        $modal.modal('show');
    });
}