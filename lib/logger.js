const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info', // Nivel por defecto
  encoding: 'utf-8', // Formato de salida
  transport: (!process.env.NODE_ENV || process.env.NODE_ENV === 'production')
    ? undefined // En producción o si NODE_ENV no está definido, usa el formato JSON por defecto.
    : {
      target: 'pino-pretty',
      options: {
        translateTime: 'SYS:HH:MM:ss',      // Para ver la hora en formato estándar del sistema
        ignore: 'pid,hostname',   // Opcional: simplifica la salida
        colorize: true,           // Opcional: colores en consola
        levelFirst: true,         // Opcional: muestra el nivel primero
        caller: true              // Muestra el archivo y la línea que generó el log
      }
    }
});

module.exports = logger