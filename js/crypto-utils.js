// js/crypto-utils.js

//Convierte un texto plano (contraseña) a un hash SHA-256 en formato Hexadecimal
export async function encriptarContrasena(textoPlano) {
    const encoder = new TextEncoder();
    const data = encoder.encode(textoPlano);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Convertimos cada byte a representación hexadecimal
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}