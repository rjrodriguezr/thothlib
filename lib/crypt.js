/**
 * @module encryptionUtil
 * @description Módulo de utilidad para la encriptación, desencriptación y hashing de datos.
 * Utiliza el algoritmo AES-256-GCM para una encriptación autenticada, que garantiza
 * tanto la confidencialidad como la integridad de los datos.
 */

const logger = require('./logger');
const crypto = require('crypto');

// --- CONFIGURACIÓN DE SEGURIDAD ---

// Variable de entorno que contiene la clave de encriptación.
// DEBE ser una cadena hexadecimal de 64 caracteres, que representa 32 bytes de datos.
// el valor '9fc8ebc4932969ef4c626add7a36a58db892c1698d44cae8ba326e2e97bb5fb8' es para que al no tener la variable no se caiga la carga. 
// cuando no se tiene el ENCRYPTION_KEY como variable es porque el modulo que usa la libreria no va a usar encriptacion
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '9fc8ebc4932969ef4c626add7a36a58db892c1698d44cae8ba326e2e97bb5fb8';

// Verificación crítica al inicio de la aplicación.
// Si la clave no está definida o no tiene el formato correcto, la aplicación no debe continuar.
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    logger.error('CRITICAL: La variable de entorno ENCRYPTION_KEY no está definida o no es una cadena hexadecimal de 64 caracteres.');
    // En un entorno de producción, es crucial detener la ejecución para evitar que la
    // aplicación se inicie en un estado inseguro. Ver la explicación en la segunda parte.
    process.exit(1);
}

// Convierte la clave de formato hexadecimal a un Buffer, que es el formato requerido por la API de crypto.
const key = Buffer.from(ENCRYPTION_KEY, 'hex');

// Constantes para el algoritmo de encriptación.
const ALGORITHM = 'aes-256-gcm'; // Algoritmo robusto que incluye autenticación (GCM).
const IV_LENGTH = 16; // Longitud del Vector de Inicialización (IV) en bytes. 16 bytes es común y seguro.


/**
 * Encripta un texto utilizando el algoritmo AES-256-GCM.
 * El resultado es una cadena que contiene el IV, el tag de autenticación y el texto cifrado,
 * separados por puntos, para facilitar su posterior desencriptación.
 *
 * @param {string | null | undefined} text - El texto a encriptar. Si es nulo, indefinido o vacío, se devuelve tal cual.
 * @returns {string | null | undefined} El texto encriptado en formato 'iv.authTag.encryptedText' o el texto original si no era válido.
 */
const encrypt = (text) => {
    // Si el texto de entrada no es válido, no hay nada que encriptar.
    if (text === null || typeof text === 'undefined' || text === '') {
        return text;
    }

    // 1. Generar un Vector de Inicialización (IV) aleatorio para cada encriptación.
    // Esto asegura que encriptar el mismo texto varias veces produzca resultados diferentes.
    const iv = crypto.randomBytes(IV_LENGTH);

    // 2. Crear un objeto 'cipher' con el algoritmo, la clave y el IV.
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // 3. Encriptar el texto. Se actualiza con el texto y se finaliza.
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 4. Obtener el Tag de Autenticación. Este tag es crucial en GCM para verificar la integridad
    // y autenticidad del dato durante la desencriptación.
    const authTag = cipher.getAuthTag();

    // 5. Devolver una cadena estructurada con todos los componentes necesarios para la desencriptación.
    // Formato: [iv en hex].[authTag en hex].[texto encriptado en hex]
    return `${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted}`;
}

/**
 * Desencripta un texto que fue encriptado previamente con la función `encrypt`.
 * Falla de forma segura si el texto ha sido manipulado o si la clave de encriptación es incorrecta.
 *
 * @param {string | null | undefined} text - El texto encriptado en formato 'iv.authTag.encryptedText'.
 * @returns {string} El texto original desencriptado.
 * @throws {Error} Lanza un error si la desencriptación falla (ej. tag de autenticación inválido),
 * lo que indica posible corrupción o manipulación de datos.
 */
const decrypt = (text) => {
    // Si el texto de entrada no es válido o no tiene el formato esperado, devolverlo sin intentar desencriptar.
    if (text === null || typeof text === 'undefined' || text === '' || !String(text).includes('.')) {
        return text;
    }

    try {
        // 1. Separar las tres partes del texto encriptado: IV, tag de autenticación y el cifrado.
        const parts = String(text).split('.');
        if (parts.length !== 3) {
            console.warn(`[Encryption] Formato de texto cifrado inválido para: ${text}. Se esperaban 3 partes separadas por '.'`);
            return text; // Devolver el texto original si el formato es incorrecto.
        }

        // 2. Convertir las partes de hexadecimal a Buffers.
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedText = parts[2];

        // 3. Crear el objeto 'decipher' con los mismos parámetros (algoritmo, clave, IV).
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        // 4. Establecer el tag de autenticación. Este es el paso de verificación de integridad.
        // Si el tag no coincide, la llamada a `decipher.final()` lanzará un error.
        decipher.setAuthTag(authTag);

        // 5. Desencriptar el texto.
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;

    } catch (error) {
        logger.error(`[Encryption] Fallo al desencriptar: ${error.message}`, { text });
        // Es una práctica de seguridad más robusta lanzar un error que devolver
        // el texto cifrado original, ya que esto alerta al sistema de un problema grave.
        throw new Error('Decryption failed. Data may be tampered or key may be incorrect.');
    }
}

/**
 * Genera un hash SHA-256 de una entrada dada. Es un proceso de un solo sentido.
 * Útil para almacenar contraseñas o verificar la integridad de datos sin necesidad de revertirlos.
 *
 * @param {*} text - La entrada a hashear. Será convertida a string.
 * @returns {string} El hash SHA-256 resultante, codificado en hexadecimal.
 */
const hash = (text) => {
    // Convierte cualquier tipo de entrada a una cadena para poder hashearla de forma consistente.
    const stringToHash = String(text);
    return crypto.createHash('sha256').update(stringToHash).digest('hex');
}

// Exporta las funciones para que puedan ser utilizadas en otras partes de la aplicación.
module.exports = { encrypt, decrypt, hash };