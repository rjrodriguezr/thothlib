const logger = require('../../lib/logger');
const { headers, WEBHOOK_SOURCE_TYPE } = require('../../lib/constants');
/**
 * @module authClient
 * @description Middleware de Express para autenticar y autorizar peticiones internas entre servicios.
 * Valida un token secreto y extrae información del usuario desde las cabeceras HTTP
 * para inyectarla en el objeto `req`.
 */

/**
 * Middleware para validar si una petición proviene de un servicio interno autorizado.
 *
 * 1.  Verifica la presencia y validez de una cabecera de autenticación interna (`X-Internal-Request`).
 * 2.  Si la petición no es de un Webhook, extrae y valida cabeceras con datos de usuario
 * (`X-User-Company`, `X-User-Name`, `X-User-Roles`).
 * 3.  Parsea los datos del usuario (compañía y roles) que vienen en formato JSON.
 * 4.  Inyecta un objeto `token` en el objeto `req` con la información del usuario para
 * su uso en los siguientes middlewares o controladores.
 *
 * @async
 * @function authClient
 * @param {import('express').Request} req - El objeto de la petición de Express. Se espera que contenga cabeceras personalizadas.
 * @param {import('express').Response} res - El objeto de la respuesta de Express.
 * @param {import('express').NextFunction} next - La función para pasar al siguiente middleware.
 * @returns {Promise<void>} No devuelve un valor directamente, sino que finaliza la petición con un error o la pasa al siguiente middleware.
 */
const authClient = async (req, res, next) => {
    logger.debug("[authClient] INICIO de la validacion del request");
    logger.debug({ msg: "[authClient]", headers: req.headers });

    // Extraer datos de usuario desde headers personalizados    
    const sourceType = req.header(headers.SOURCE_TYPE);
    if (sourceType && sourceType === WEBHOOK_SOURCE_TYPE) {
        logger.verbose(`[authClient] sourceType: ${sourceType}, ignorando la validacion de seguridad de llamados internos `);
    } else {
        logger.verbose("[authClient] No sourceType presente por lo que se procesan cabeceras de llamados internos");
        const companyId = req.header(headers.COMPANY_ID);
        const userId = req.header(headers.USER_ID);
        const username = req.header(headers.USER_NAME); 

        if (!(companyId || userId || username)) {
            return res.status(401).json({ error: 'Faltan Headers de datos del usuario' });
        }

        // Agregar objeto `token` al request
        req.token = {
            companyId,
            userId,
            username,
        };
        logger.verbose({file:'[authClient]',token:req.token});
    }

    next();
}

module.exports = authClient;