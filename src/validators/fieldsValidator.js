const { body, param, query, validationResult } = require('express-validator');
const logger = require("../../lib/logger");

/**
 * Middleware de validación de campos usando express-validator
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 * @returns 
 */
const fieldsValidator = (req, res, next) => {
    // Obtenemos los errores de validación del request usando express-validator
    const errors = validationResult(req);

    // Verificamos si hay errores
    if (!errors.isEmpty()) {
        // Convertimos los errores en un array (ya que validationResult devuelve un objeto con métodos)
        const errorArray = errors.array();

        // Extraemos solo los mensajes de error y los unimos en un solo string separado por " | "
        const errorMessage = errorArray.map(err => err.msg).join(' | ');

        // Registramos en el log los errores detalladamente
        logger.error({
            validator: "Validación fallida", // Etiqueta para identificar el origen del log
            errors: errorArray             // Array con los errores de validación
        });

        // Respondemos al cliente con un error 400 (Bad Request) y el mensaje de error
        return res.status(400).json({
            message: errorMessage,  // Mensaje resumen
            errors: errorArray      // Detalle completo de los errores (campo, mensaje, ubicación, etc.)
        });
    }

    // Si no hay errores, pasamos al siguiente middleware/controlador
    next();
};

/**
 * Validador genérico de campos de texto
 * @param {string} attr - Nombre del atributo
 * @param {boolean} required - Si el campo es requerido o no
 */
const validateText = (attr, required = true) => {
    const validator = body(attr).trim();
    return required
        ? validator.exists().withMessage(`${attr} es obligatorio`).notEmpty().withMessage(`${attr} no puede estar vacío`)
        : validator.optional().notEmpty().withMessage(`${attr} no puede estar vacío`);
};

/**
 * Validador para campos numéricos (enteros o flotantes)
 * @param {string} attr - Nombre del atributo
 * @param {boolean} isFloat - Si el número debe permitir decimales
 * @param {boolean} required - Si el campo es obligatorio
 */
const validateNumber = (attr, isFloat = false, required = true) => {
    const validator = body(attr);
    const chain = required ? validator.exists().withMessage(`${attr} es obligatorio`) : validator.optional();

    return isFloat
        ? chain.isFloat({ min: 0 }).withMessage(`${attr} debe ser un número decimal mayor o igual a 0`)
        : chain.isInt({ min: 0 }).withMessage(`${attr} debe ser un número entero mayor o igual a 0`);
};

/**
 * Validador para campos de email
 * @param {string} attr - Nombre del atributo
 * @param {boolean} _ - Parámetro reservado para mantener estructura uniforme (no aplica aquí)
 * @param {boolean} required - Si el campo es obligatorio
 */
const validateEmail = (attr, _, required = true) => {
    const validator = body(attr).trim();
    const chain = required
        ? validator.exists().withMessage(`${attr} es obligatorio`)
        : validator.optional();

    return chain
        .notEmpty().withMessage(`${attr} no puede estar vacío`)
        .isEmail().withMessage(`${attr} debe ser un email válido`);
    //When using .normalizeEmail(), Gmail addresses have their dots removed as they are ignored by Gmail.
    //.normalizeEmail();
};

/**
 * Valida que un campo sea un MongoID válido
 * @param {'body' | 'param' | 'query'} source - Fuente del valor ('body', 'param' o 'query')
 * @param {string} field - Nombre del campo a validar (por defecto: "id")
 */
const validateMongoId = (source, field = "_id", required = true) => {
    let location;

    switch (source) {
        case 'param':
            location = param;
            break;
        case 'query':
            location = query;
            break;
        case 'body':
        default:
            location = body;
            break;
    }

    let validator = location(field);
    if (required) {
        validator = validator.exists().withMessage(`El campo '${field}' es obligatorio`);
    } else {
        validator = validator.optional();
    }
    return validator.isMongoId().withMessage(`El campo '${field}' no es un ObjectId válido`);
};
const validateDate = (attr, required = true) => {
    const validator = body(attr).trim();
    return required
        ? validator
            .exists().withMessage(`${attr} es obligatorio`)
            .notEmpty().withMessage(`${attr} no puede estar vacío`)
            .isISO8601().toDate().withMessage(`${attr} debe ser una fecha válida`)
        : validator
            .optional()
            .notEmpty().withMessage(`${attr} no puede estar vacío`)
            .isISO8601().toDate().withMessage(`${attr} debe ser una fecha válida`);
};

// Exports
module.exports = {
    fieldsValidator,
    validateDate,
    validateEmail,
    validateMongoId,
    validateNumber,
    validateText,
};