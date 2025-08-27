const Redis = require('ioredis'); // Cambiado de 'redis' a 'ioredis'
const logger = require('./logger');

class RedisService {
    constructor(options = {}) {
        this.redisUrl = options.url;
        this.redisPassword = options.password || process.env.REDIS_PASSWORD || undefined;
        this.client = null;
        this.isClosing = false;
    }

    get clientInstance() {
        if (!this.client) {
            logger.warn('Se intentó acceder al cliente Redis antes de que se estableciera la conexión.');
        }
        return this.client;
    }

    async connect() {
        if (this.client && this.client.status === 'ready') {
            logger.info('El cliente Redis ya está conectado y listo.');
            return;
        }

        //logger.info('Intentando conectar a Redis con ioredis...');
        try {
            // ioredis acepta la URL directamente o un objeto de opciones
            this.client = new Redis(this.redisUrl, {
                password: this.redisPassword,
                // Opciones adicionales para ioredis, por ejemplo:
                // reconnectOnError: (err) => {
                //     const targetErrors = ['READONLY', 'ETIMEDOUT'];
                //     if (targetErrors.some(targetError => err.message.includes(targetError))) {
                //         return true; // Intentar reconectar en estos errores
                //     }
                //     return false;
                // },
                // enableOfflineQueue: true, // Cola de comandos mientras está desconectado
                // maxRetriesPerRequest: null, // Reintentos ilimitados para comandos en cola
            });
            // Manejar eventos de conexión y errores para ioredis
            // client.on('connect', () => {
            //     logger.info('Conectando a Redis...');
            // });

            this.client.on('ready', () => {
                const safeUrl = new URL(this.redisUrl);
                logger.info(`Conexión Redis a ${safeUrl.hostname}:${safeUrl.port} establecida y lista.`);
            });

            this.client.on('error', (err) => {
                logger.error('Error de conexión a Redis:', err);
                // Aquí puedes agregar lógica para manejar errores específicos,
                // como intentar reconectar o notificar a un sistema de monitoreo.
            });

            this.client.on('end', () => {
                logger.info('Conexión a Redis finalizada.');
            });

            this.client.on('close', () => {
                logger.info('Conexión a Redis cerrada.');
            });

            // Con ioredis, la conexión se establece automáticamente al instanciar el cliente.
            // Podemos esperar el evento 'ready' para asegurar que esté completamente listo.
            await new Promise((resolve, reject) => {
                this.client.once('ready', resolve);
                this.client.once('error', reject);
            });

            //logger.info('Cliente Redis conectado exitosamente.');

        } catch (err) {
            logger.error('Fallo al conectar a Redis:', err);
            // Asegúrate de cerrar el cliente si la conexión inicial falla
            if (this.client) {
                this.client.disconnect(); // O client.quit() si quieres asegurar que no haya reintentos
                this.client = null;
            }
            throw err; // Relanzar el error para que la aplicación lo maneje
        }
    }

    /**
     * Cierra la conexión con el servidor Redis.
     * Este método debe ser llamado al cerrar la aplicación.
     * @returns {Promise<void>} Una promesa que se resuelve cuando la conexión se ha cerrado.
     */
    async close() {
        logger.info('Registrando cierre de conexiones Redis.');
        if (this.isClosing) {
            logger.verbose('Cierre de Redis ya en progreso, evitando múltiples llamadas.');
            return; // Evitar múltiples llamadas simultáneas
        }
        this.isClosing = true;

        // Verificar el estado del cliente antes de intentar cerrar
        if (this.client && this.client.status !== 'end' && this.client.status !== 'disconnecting') {
            logger.verbose('Cerrando el cliente Redis...');
            try {
                await this.client.quit(); // 'quit' cierra la conexión y no permite reconexiones
                logger.info('Cliente Redis cerrado.');
            } catch (err) {
                logger.error('Error al cerrar el cliente Redis:', err);
            }
        } else {
            logger.info('El cliente Redis no estaba activo o ya estaba cerrándose para cerrar.');
        }
        this.isClosing = false; // Resetear el estado de cierre
        this.client = null; // Limpiar la referencia al cliente
    }
    /**
     * Almacena un valor en Redis asociado a una clave.
     * Si el valor es un objeto o array, se serializa a JSON.
     * @param {string} key - La clave bajo la cual almacenar el valor.
     * @param {*} value - El valor a almacenar. Puede ser string, número, booleano, objeto o array.
     * @param {Array<string|number>} [options=[]] - Opciones adicionales para el comando SET de Redis (ej: ['EX', 3600] para expiración en segundos).
     * @returns {Promise<string|null>} El resultado del comando SET ('OK' si tiene éxito) o null si hay error o el cliente no está disponible.
     */
    async setData(key, value, options = []) {
        if (!this.client || this.client.status !== 'ready') {
            logger.error('Cliente Redis no disponible o no listo para setData.');
            return null;
        }
        if (typeof key !== 'string') {
            logger.error('La clave para setData debe ser una cadena de texto.');
            return null;
        }

        try {
            let storeValue;
            if (value === null || value === undefined) { // Redis no almacena bien undefined, null se guarda como "null"
                logger.warn(`El valor para la clave "${key}" es nulo o indefinido. No se realizará ninguna acción. Use delData para eliminar la clave explícitamente.`);
                return null; // No hacer nada es más limpio que guardar un string vacío.
            }  else if (typeof value === 'object') { // Incluye arrays y objetos JSON
                storeValue = JSON.stringify(value);
            } else {
                storeValue = String(value); // Asegura que números y booleanos se guarden como strings
            }

            const result = await this.client.set(key, storeValue, ...options);
            logger.verbose(`Datos guardados en Redis para la clave "${key}".`);
            return result; // 'OK'
        } catch (error) {
            logger.error(`Error al guardar datos en Redis para la clave "${key}" -> error:${error.message}`);
            return null;
        }
    }

    /**
     * Recupera un valor de Redis dada una clave.
     * Intenta deserializar el valor si es una cadena JSON.
     * @param {string} key - La clave del valor a recuperar.
     * @returns {Promise<*|null>} El valor recuperado (deserializado si es JSON), o null si la clave no existe, el cliente no está disponible, o hay un error.
     */
    async getData(key) {
        if (!this.client || this.client.status !== 'ready') {
            logger.error('Cliente Redis no disponible o no listo para getData.');
            return null;
        }
        if (typeof key !== 'string') {
            logger.error('La clave para getData debe ser una cadena de texto.');
            return null;
        }

        try {
            const value = await this.client.get(key);

            if (value === null) {
                logger.verbose(`No se encontró valor en Redis para la clave "${key}".`);
                return null; // La clave no existe
            }

            try {
                // Intenta parsear como JSON.
                const parsedValue = JSON.parse(value);
                logger.verbose(`Datos recuperados y parseados (JSON) de Redis para la clave "${key}".`);
                return parsedValue;
            } catch (e) {
                // Si falla el parseo JSON, es probable que sea un string simple, número o booleano guardado como string.
                logger.verbose(`Datos recuperados (string) de Redis para la clave "${key}". No se pudo parsear como JSON, devolviendo valor crudo.`);
                return value;
            }
        } catch (error) {
            logger.error(`Error al obtener datos de Redis para la clave "${key}" -> error:${error.message}`);
            return null;
        }
    }

    /**
     * Elimina una o más claves de Redis.
     * @param {string|string[]} keys - Una clave única o un array de claves a eliminar.
     * @returns {Promise<number|null>} El número de claves que fueron eliminadas, o null si hay error o el cliente no está disponible.
     */
    async delData(keys) {
        if (!this.client || this.client.status !== 'ready') {
            logger.error('Cliente Redis no disponible o no listo para delData.');
            return null;
        }
        if (!(typeof keys === 'string' || (Array.isArray(keys) && keys.every(k => typeof k === 'string')))) {
            logger.error('La(s) clave(s) para delData deben ser una cadena de texto o un array de cadenas.');
            return null;
        }

        try {
            const result = await this.client.del(keys); // ioredis del puede tomar un string o un array de strings
            logger.verbose(`Clave(s) eliminada(s) de Redis: ${Array.isArray(keys) ? keys.join(', ') : keys}. Resultado: ${result}`);
            return result; // Número de claves eliminadas
        } catch (error) {
            logger.error(`Error al eliminar datos en Redis para la(s) clave(s) "${keys}" -> error:${error.message}`);
            return null;
        }
    }

    /**
         * Asegura que un Stream y un Grupo de Consumidores existan.
         * Es idempotente: si ya existen, no hace nada y no lanza error.
         * @param {string} streamKey - El nombre del stream (ej: 'incoming_messages').
         * @param {string} groupName - El nombre del grupo de consumidores (ej: 'core_processors_group').
         * @returns {Promise<boolean>} Devuelve true si la operación fue exitosa o si ya existían, false si hubo un error.
         */
    async setupStreamGroup(streamKey, groupName) {
        if (!this.client || this.client.status !== 'ready') {
            logger.error('Cliente Redis no disponible para setupStreamGroup.');
            return false;
        }
        try {
            await this.client.xgroup('CREATE', streamKey, groupName, '$', 'MKSTREAM');
            logger.info(`Stream '${streamKey}' y grupo '${groupName}' asegurados.`);
            return true;
        } catch (error) {
            if (error.message.includes('BUSYGROUP')) {
                logger.verbose(`El grupo '${groupName}' ya existe en el stream '${streamKey}'. No se requiere acción.`);
                return true; // Es el comportamiento esperado si ya existe, así que es un "éxito"
            }
            logger.error(`Error al crear stream/grupo '${streamKey}/${groupName}':`, error);
            return false;
        }
    }

    /**
     * Publica un mensaje (payload) en un stream de Redis.
     * @param {string} streamKey - La clave del stream donde publicar.
     * @param {object} messagePayload - El objeto de JavaScript que se publicará. Será serializado a JSON.
     * @returns {Promise<string|null>} El ID del mensaje creado, o null si hay un error.
     */
    async publishToStream(streamKey, messagePayload) {
        if (!this.client || this.client.status !== 'ready') {
            logger.error('Cliente Redis no disponible para publishToStream.');
            return null;
        }
        try {
            const payloadString = JSON.stringify(messagePayload);
            const messageId = await this.client.xadd(streamKey, '*', 'payload', payloadString);
            logger.verbose(`Mensaje publicado en stream '${streamKey}' con ID: ${messageId}`);
            return messageId;
        } catch (error) {
            logger.error(`Error al publicar en el stream '${streamKey}':`, error);
            return null;
        }
    }

    /**
     * Lee mensajes de un stream para un grupo de consumidores específico.
     * @param {string} streamKey - La clave del stream del que se leerá.
     * @param {string} groupName - El nombre del grupo de consumidores.
     * @param {string} consumerName - Un identificador único para esta instancia de consumidor.
     * @param {object} [options={}] - Opciones como 'block' (milisegundos), 'count' y 'readPending'.
     * @param {number} [options.block=5000] - Tiempo de bloqueo en milisegundos.
     * @param {number} [options.count=1] - Número máximo de mensajes a leer.
     * @param {boolean} [options.readPending=false] - Si es `true`, lee los mensajes pendientes (no confirmados) en lugar de los nuevos.
     * @returns {Promise<Array<object>|null>} Un array de mensajes parseados, o null si hay un error. Cada objeto es { id, payload }.
     */
    async readFromStreamGroup(streamKey, groupName, consumerName, options = {}) {
        if (!this.client || this.client.status !== 'ready') {
            logger.error('Cliente Redis no disponible para readFromStreamGroup.');
            return null;
        }
        try {
            const block = options.block || 5000; // Bloquear hasta 5 segundos por defecto
            const count = options.count || 1;    // Leer 1 mensaje por defecto
            const readFromId = options.readPending ? '0' : '>'; // '0' para pendientes, '>' para nuevos

            logger.verbose(`Leyendo stream '${streamKey}' para grupo '${groupName}' (consumidor: ${consumerName}). Origen: ${readFromId === '0' ? 'pendientes' : 'nuevos'}.`);

            const response = await this.client.xreadgroup(
                'GROUP', groupName, consumerName,
                'BLOCK', block,
                'COUNT', count,
                'STREAMS', streamKey, readFromId
            );

            if (!response) {
                return []; // Timeout, no hay mensajes nuevos, es un resultado normal.
            }

            // Parsear la respuesta compleja de ioredis
            const [stream] = response;
            const [streamName, messages] = stream;

            return messages.map(msg => {
                const [id, fields] = msg;
                const payloadString = fields[fields.indexOf('payload') + 1];
                return {
                    id: id,
                    payload: JSON.parse(payloadString)
                };
            });
        } catch (error) {
            logger.error(`Error al leer del stream '${streamKey}' para el grupo '${groupName}':`, error);
            return null; // Indica un error real en la operación
        }
    }

    /**
     * Envía un acuse de recibo (ACK) para uno o más mensajes de un stream.
     * @param {string} streamKey - La clave del stream.
     * @param {string} groupName - El nombre del grupo de consumidores.
     * @param {string|string[]} messageIds - El ID o array de IDs de los mensajes a confirmar.
     * @returns {Promise<number|null>} El número de mensajes confirmados, o null si hay error.
     */
    async ackStreamMessage(streamKey, groupName, messageIds) {
        if (!this.client || this.client.status !== 'ready') {
            logger.error('Cliente Redis no disponible para ackStreamMessage.');
            return null;
        }
        try {
            const result = await this.client.xack(streamKey, groupName, messageIds);
            logger.verbose(`ACK enviado para ${Array.isArray(messageIds) ? messageIds.length : 1} mensaje(s) en '${streamKey}'.`);
            return result;
        } catch (error) {
            logger.error(`Error enviando ACK para el stream '${streamKey}':`, error);
            return null;
        }
    }

    /**
     * Publica un mensaje en un canal de Pub/Sub de Redis.
     * @param {string} channel - El canal al que se publicará el mensaje.
     * @param {object} payload - El objeto de JavaScript que se publicará. Será serializado a JSON.
     * @returns {Promise<number|null>} El número de clientes que recibieron el mensaje, o null si hay error.
     */
    async publish(channel, payload) {
        if (!this.client || this.client.status !== 'ready') {
            logger.error(`Cliente Redis no disponible para publicar en el canal '${channel}'.`);
            return null;
        }
        try {
            const payloadString = JSON.stringify(payload);
            const receivers = await this.client.publish(channel, payloadString);
            logger.verbose(`Mensaje publicado en canal '${channel}'. Recibido por ${receivers} subscriptores.`);
            return receivers;
        } catch (error) {
            logger.error(`Error al publicar en el canal '${channel}':`, error);
            return null;
        }
    }
}

// Para mantener la compatibilidad hacia atrás y el patrón singleton para el uso general de la app,
// creamos y exportamos una única instancia de la clase.
// Esto nos da los beneficios de la clase (encapsulación, testabilidad) sin romper el código existente.
const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`;
const redisPassword = process.env.REDIS_PASSWORD || undefined;

module.exports = new RedisService({ url: redisUrl, password: redisPassword });
module.exports.RedisService = RedisService; // Opcional: exportar también la clase para usos avanzados