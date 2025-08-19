const mongoose = require('mongoose');
const logger = require('./logger');

let isConnected = false; // Variable para rastrear el estado de la conexión
let isClosing = false; // Variable para evitar múltiples cierres

const mongoDBService = {
    /**
     * @property {mongoose.Connection} connection - La instancia de conexión de Mongoose.
     */
    get connection() {
        return mongoose.connection;
    },

    /**
     * Establece la conexión con la base de datos MongoDB.
     * Este método debe ser llamado una vez al inicio de la aplicación.
     * @returns {Promise<void>} Una promesa que se resuelve cuando la conexión es exitosa.
     */
    async connect() {
        if (isConnected) {
            logger.info('El cliente MongoDB ya está conectado.');
            return;
        }

        //logger.info('Intentando conectar a MongoDB...');
        try {
            mongoose.set('strictQuery', false); // Para suprimir la advertencia de Mongoose 7

            // Configurar listeners de eventos de conexión
            // mongoose.connection.on('connecting', () => {
            //     logger.info('Conectando a MongoDB...');
            // });

            // mongoose.connection.on('connected', () => {
            //     logger.info('Conexión a MongoDB establecida.');
            //     isConnected = true;
            // });

            mongoose.connection.on('open', async () => {
                logger.info('Conexión a MongoDB abierta y lista.');
            });

            mongoose.connection.on('error', (err) => {
                logger.error('Error de conexión a MongoDB:', err);
                isConnected = false; // Marcar como desconectado en caso de error
            });

            mongoose.connection.on('disconnected', () => {
                logger.warn('MongoDB se ha desconectado.');
                isConnected = false;
            });

            mongoose.connection.on('reconnected', () => {
                logger.info('MongoDB se ha reconectado.');
                isConnected = true;
            });

            mongoose.connection.on('close', () => {
                logger.info('Conexión a MongoDB cerrada.');
                isConnected = false;
            });

            await mongoose.connect(process.env.DATABASE_URL, {
                // Opciones de conexión adicionales si son necesarias
                // useNewUrlParser: true, // Obsoleto en Mongoose 6+
                // useUnifiedTopology: true, // Obsoleto en Mongoose 6+
            });

            //logger.info('Llamada a mongoose.connect() completada.');

        } catch (error) {
            logger.error(`Fallo al conectar a MongoDB -> error:${error.message}`);
            isConnected = false;
            throw new Error('Error a la hora de iniciar la base de datos: ' + error.message); // Relanzar el error
        }
    },

    /**
     * Cierra la conexión con la base de datos MongoDB.
     * Este método debe ser llamado al cerrar la aplicación.
     * @returns {Promise<void>} Una promesa que se resuelve cuando la conexión se ha cerrado.
     */
    async close() {
        logger.info('Registrando cierre de conexiones MongoDB.');
        if (isClosing) {
            logger.verbose('Cierre de MongoDB ya en progreso, evitando múltiples llamadas.');
            return; // Evitar múltiples llamadas simultáneas
        }
        isClosing = true;

        if (mongoose.connection.readyState === 1) { // 1 significa 'connected'
            logger.verbose('Cerrando la conexión a MongoDB...');
            try {
                await mongoose.connection.close();
                logger.info('Conexión a MongoDB cerrada.');
            } catch (err) {
                logger.error('Error al cerrar la conexión a MongoDB:', err);
            }
        } else {
            logger.info('La conexión a MongoDB no estaba activa para cerrar.');
        }
        isClosing = false; // Resetear el estado de cierre
    }
};

// Exportar el servicio MongoDB
module.exports = mongoDBService;