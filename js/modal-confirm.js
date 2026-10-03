// js/modal-confirm.js

/**
 * Muestra un modal de confirmación dinámico usando Bootstrap 4.
 * @param {Object} opciones
 * @param {string} opciones.titulo - Título del modal.
 * @param {string} opciones.mensaje - Mensaje o pregunta principal.
 * @param {string} [opciones.btnCancelarText='Cancelar'] - Texto del botón cancelar.
 * @param {string} [opciones.btnAceptarText='Aceptar'] - Texto del botón aceptar.
 * @param {string} [opciones.btnAceptarClass='btn-danger'] - Clase CSS para el botón aceptar.
 * @returns {Promise<boolean>} Devuelve true si el usuario presiona Aceptar, false si cancela o cierra.
 */
export function mostrarConfirmacion({
    titulo = 'Confirmar acción',
    mensaje = '¿Estás seguro de realizar esta acción?',
    btnCancelarText = 'Cancelar',
    btnAceptarText = 'Aceptar',
    btnAceptarClass = 'btn-danger'
}) {
    return new Promise((resolve) => {
        let modalEl = document.getElementById('modalConfirmacionGlobal');

        //sI NO existe el HTML del modal en la página, lo inyectamos al final del <body>
        if (!modalEl) {
            const modalHTML = `
                <div class="modal fade" id="modalConfirmacionGlobal" tabindex="-1" role="dialog" aria-hidden="true" data-backdrop="static">
                    <div class="modal-dialog modal-dialog-centered" role="document">
                        <div class="modal-content border-0 shadow">
                            <div class="modal-header border-bottom-0 pb-0">
                                <h5 class="modal-title font-weight-bold" id="modalConfirmacionTitulo"></h5>
                                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div class="modal-body py-3" id="modalConfirmacionMensaje"></div>
                            <div class="modal-footer border-top-0 pt-0">
                                <button type="button" class="btn btn-secondary btn-sm font-weight-bold" id="btnModalCancelar" data-dismiss="modal">
                                    ${escapeHTML(btnCancelarText)}
                                </button>
                                <button type="button" class="btn btn-sm font-weight-bold" id="btnModalAceptar">
                                    ${escapeHTML(btnAceptarText)}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modalEl = document.getElementById('modalConfirmacionGlobal');
        }

        //Actualizar contenidos y estilos dinámicos
        document.getElementById('modalConfirmacionTitulo').innerText = titulo;
        document.getElementById('modalConfirmacionMensaje').innerText = mensaje;

        const btnAceptar = document.getElementById('btnModalAceptar');
        btnAceptar.className = `btn btn-sm font-weight-bold ${btnAceptarClass}`;
        btnAceptar.innerText = btnAceptarText;

        const btnCancelar = document.getElementById('btnModalCancelar');
        btnCancelar.innerText = btnCancelarText;

        //Instancia de Bootstrap Modal ($)
        const $modal = $(modalEl);

        //Controladores de eventos para resolver la promesa
        const onAceptar = () => {
            limpiarListeners();
            $modal.modal('hide');
            resolve(true);
        };

        const onCancelar = () => {
            limpiarListeners();
            resolve(false);
        };

        function limpiarListeners() {
            btnAceptar.removeEventListener('click', onAceptar);
            $modal.off('hidden.bs.modal', onCancelar);
        }

        btnAceptar.addEventListener('click', onAceptar);
        $modal.one('hidden.bs.modal', onCancelar);

        $modal.modal('show');
    });
}

function escapeHTML(str) {
    return str ? str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    ) : '';
}