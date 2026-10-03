// js/toast.js

//Mostrar el Toast de notificación dinámico con diseño uniforme
export function mostrarToast(mensaje, tipo = 'info', duracion = 4500) {
    let container = document.getElementById('toast-container');
    
    // Crear el contenedor superior derecho si no existe
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1090; min-width: 300px; max-width: 380px;';
        document.body.appendChild(container);
    }

    // Configuración de colores e íconos uniformes por tipo
    const config = {
        success: { bg: 'bg-success text-white', icon: 'fas fa-check-circle' },
        warning: { bg: 'bg-warning text-dark', icon: 'fas fa-exclamation-triangle' },
        danger:  { bg: 'bg-danger text-white', icon: 'fas fa-times-circle' },
        info:    { bg: 'bg-info text-white', icon: 'fas fa-info-circle' }
    };

    const toastConfig = config[tipo] || config.info;
    const toastId = `toast-${Date.now()}`;

    // Estructura uniforme de una sola pieza
    const toastHTML = `
        <div id="${toastId}" class="toast show shadow ${toastConfig.bg} border-0 mb-2 rounded p-3" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center">
                    <i class="${toastConfig.icon} mr-2 fa-lg"></i>
                    <span class="font-weight-bold small">${mensaje}</span>
                </div>
                <button type="button" class="close ${tipo === 'warning' ? 'text-dark' : 'text-white'} ml-3 opacity-8" style="outline:none;" aria-label="Close" onclick="this.closest('.toast').remove()">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', toastHTML);

    // Auto-destrucción programada
    setTimeout(() => {
        const el = document.getElementById(toastId);
        if (el) {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 200); // Pequeño fade out antes de remover
        }
    }, duracion);
}