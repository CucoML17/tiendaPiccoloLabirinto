
document.addEventListener('DOMContentLoaded', () => {

    //Cargar Footer (si existe el contenedor en la página)
    const footerContainer = document.getElementById('footer-container');
    if (footerContainer) {
        fetch('footer.html')
            .then(response => {
                if (!response.ok) throw new Error('Error al cargar footer.html');
                return response.text();
            })
            .then(data => {
                footerContainer.innerHTML = data;
                // Actualizar el año de los derechos de autor dinámicamente
                const yearElem = document.getElementById('yearFooter');
                if (yearElem) {
                    yearElem.textContent = new Date().getFullYear();
                }
            })
            .catch(error => console.error(error));
    }
});