const { createLogger, format, transports } = require('winston');
const path = require('path'); 

const myFormat = format.printf(log => {
  let formato;
  if (log.stack) {
    let pathFromStack = log.stack.split('\n')[1].slice(7);
    let buff = Buffer.from(pathFromStack);
    // NOTA: 'lastIndexOf' con '\\' solo funciona en Windows. path.sep es más seguro.
    let fileAndLineNumber = pathFromStack.slice(buff.lastIndexOf(path.sep) + 1); // queda algo asi User.js:45:15)
    let msg = `(${fileAndLineNumber} ${log.message}`; /// se agrega '(' delante para que quede asi: (User.js:45:15) ${message} 
    formato = `[${log.label}] ${log.level} [${log.timestamp}]: ${msg}`;
  } else {
    formato = `[${log.label}] ${log.level} [${log.timestamp}]: ${log.message}`;
  }
  return formato;
});

let apiLabel = process.env.API_NAME || '';
let apiName = apiLabel.length > 0 ? `thothify-api-${apiLabel}` : 'thothify-api';
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.errors({ stack: true }),
    format.json(),
    format.colorize({ all: true }),
    format.label({ label: apiName }),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    myFormat
  ),
  transports: [
    new transports.Console(),
    //new transports.File({ filename: 'logs/combined.log' })
  ]
});

module.exports = logger