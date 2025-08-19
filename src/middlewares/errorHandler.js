const logger = require('../../lib/logger'); // Ajusta la ruta si es necesario

const responseHandleError = (err, req, res) => {
    const statusCode = err.status || err.statusCode || 500;
    const environment = process.env.ENVIRONMENT || 'prd';

    // Loguear el error
    if (environment === 'development' || environment === 'dev') {
        logger.error('[ErrorHandler] Stack Trace:', err.stack);
    } else {
        logger.error(`[ErrorHandler] Status: ${statusCode}, Message: ${err.message}, Path: ${req.originalUrl}, Method: ${req.method}`);
    }

    // Construir la respuesta
    const responseError = {
        message: err.message || 'Ocurrió un error inesperado en el servidor.',
        ...(environment === 'development' || environment === 'dev' ? { stack: err.stack, details: err.details || err.data } : {}),
        ...(err.errorCode ? { errorCode: err.errorCode } : {}),
    };
    
    // Lógica específica para errores de validación
    if (Array.isArray(err.details) && err.message === 'ValidationFailed') {
        responseError.message = 'Error de validación en la solicitud.';
        responseError.validationErrors = err.details;
        delete responseError.stack;
    }
    
    res.status(statusCode).json(responseError);
};

/**
 * Middleware de manejo de errores global.
 * Este middleware debe ser el último en la cadena de middlewares de Express.
 */
const middlewareHandleError = (err, req, res, next) => {
    // Si los encabezados ya se enviaron, delega a Express. Esta es la única lógica de middleware que queda.
    if (res.headersSent) {
        logger.warn('[HandleErrorResponse] Los headers ya fueron enviados. No se puede enviar nueva respuesta.');
        return next(err);
    }

    // En todos los demás casos, usa la función de lógica centralizada.
    responseHandleError(err, req, res);
};

module.exports = {responseHandleError, middlewareHandleError};
