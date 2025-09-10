// const { createLogger, format, transports } = require('winston');
// const path = require('path'); 

// const myFormat = format.printf(log => {
//   let formato;
//   if (log.stack) {
//     let pathFromStack = log.stack.split('\n')[1].slice(7);
//     let buff = Buffer.from(pathFromStack);
//     // NOTA: 'lastIndexOf' con '\\' solo funciona en Windows. path.sep es más seguro.
//     let fileAndLineNumber = pathFromStack.slice(buff.lastIndexOf(path.sep) + 1); // queda algo asi User.js:45:15)
//     let msg = `(${fileAndLineNumber} ${log.message}`; /// se agrega '(' delante para que quede asi: (User.js:45:15) ${message} 
//     formato = `[${log.label}] ${log.level} [${log.timestamp}]: ${msg}`;
//   } else {
//     formato = `[${log.label}] ${log.level} [${log.timestamp}]: ${log.message}`;
//   }
//   return formato;
// });

// let apiLabel = process.env.API_NAME || '';
// let apiName = apiLabel.length > 0 ? `thothify-api-${apiLabel}` : 'thothify-api';
// const logger = createLogger({
//   level: process.env.LOG_LEVEL || 'info',
//   format: format.combine(
//     format.errors({ stack: true }),
//     format.json(),
//     format.colorize({ all: true }),
//     format.label({ label: apiName }),
//     format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
//     myFormat
//   ),
//   transports: [
//     new transports.Console(),
//     //new transports.File({ filename: 'logs/combined.log' })
//   ]
// });

const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info', // Nivel por defecto
  encoding: 'utf-8', // Formato de salida
  transport: (!process.env.NODE_ENV || process.env.NODE_ENV === 'production')
    ? undefined // En producción o si NODE_ENV no está definido, usa el formato JSON por defecto.
    : {
      target: 'pino-pretty',
      options: {
        translateTime: false,     // Evita problemas con caracteres especiales
        ignore: 'pid,hostname',   // Opcional: simplifica la salida
        colorize: true,           // Opcional: colores en consola
        levelFirst: true          // Opcional: muestra el nivel primero
      }
    }
});

module.exports = logger