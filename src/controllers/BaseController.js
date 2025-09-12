const logger = require('../../lib/logger');
class BaseController {

    constructor() {
        // Envolvemos los métodos públicos en el manejador de errores asíncrono.
        // Esto centraliza la gestión de excepciones y limpia los métodos del controlador.
        // Usamos .bind(this) para asegurar que 'this' dentro de los métodos siga siendo la instancia del controlador.
        this.insert = this._catchAsync(this.insert.bind(this), 'inserting');
        this.get = this._catchAsync(this.get.bind(this), 'fetching');
        this.delete = this._catchAsync(this.delete.bind(this), 'deleting');
        this.update = this._catchAsync(this.update.bind(this), 'updating');
        this.echo = this._catchAsync(this.echo.bind(this), 'echoing');
    }

    /**
     * Envuelve una función asíncrona de controlador para capturar errores y pasarlos al manejador de errores centralizado.
     * @param {Function} fn - La función asíncrona del controlador a envolver.
     * @param {string} action - La acción que se está realizando (ej. 'inserting', 'deleting').
     * @returns {Function} Una nueva función que maneja la lógica de try/catch.
     * @private
     */
    _catchAsync(fn, action) {
        return (req, res) => {
            fn(req, res).catch(err => {
                // Determina si hay un ID de recurso en los parámetros de la ruta
                const resourceId = req.params.id || null;
                this._handleError(res, err, action, resourceId);
            });
        };
    }

    /**
     * Centralized error handler for the controller.
     * @param {object} res - The Express response object.
     * @param {Error} error - The error object caught.
     * @param {string} action - The action being performed (e.g., 'inserting', 'updating').
     * @param {string|null} [resourceId=null] - The ID of the resource, if applicable.
     * @private
     */
    _handleError(res, error, action, resourceId = null) {
        const resourceInfo = resourceId ? ` with id ${resourceId}` : '';
        const logMessage = `Error ${action} resource${resourceInfo}`;
        const clientMessage = `Error ${action} resource`;

        // Manejo específico para métodos no implementados en clases hijas
        if (error.message.includes('not implemented')) {
            logger.error(`Method for action '${action}' is not implemented in the derived controller.`, error);
            return res.status(501).json({ message: `Functionality for '${action}' is not implemented.` });
        }

        logger.error(logMessage, error);

        // The service layer throws an error containing "not found" for 404 cases
        const isNotFound = error.message.includes('not found');
        const statusCode = isNotFound ? 404 : 500;

        res.status(statusCode).json({ message: clientMessage, error: error.message });
    }

    /**
     * Inserta un nuevo recurso. Este método debe ser sobreescrito por la clase hija.
     * La lógica de negocio se inyecta en la implementación de la clase derivada.
     */
    async insert(req, res) {
        // LOGICA DE NEGOCIO (a ser implementada por la clase hija)
        throw new Error('Method "insert" not implemented.');
    }

    /**
     * Obtiene recursos. Este método debe ser sobreescrito por la clase hija.
     * La lógica de negocio se inyecta en la implementación de la clase derivada.
     */
    async get(req, res) {
        // LOGICA DE NEGOCIO (a ser implementada por la clase hija)
        throw new Error('Method "get" not implemented.');
    }

    /**
     * Elimina un recurso. Este método debe ser sobreescrito por la clase hija.
     * La lógica de negocio se inyecta en la implementación de la clase derivada.
     */
    async delete(req, res) {
        // LOGICA DE NEGOCIO (a ser implementada por la clase hija)
        throw new Error('Method "delete" not implemented.');
    }

    /**
     * Actualiza un recurso. Este método debe ser sobreescrito por la clase hija.
     * La lógica de negocio se inyecta en la implementación de la clase derivada.
     */
    async update(req, res) {
        // LOGICA DE NEGOCIO (a ser implementada por la clase hija)
        throw new Error('Method "update" not implemented.');
    }

    async echo(req, res) {
        // authclient sube al request al request los datos del token {companyId, userId, username}
        const { companyId, username, userId } = req.token;
        logger.info({ companyId, username, userId });

        if (req.method === "GET") {
            res.json({ message: `GET ECHO: Dummy ok` });
        } else {
            res.json({ message: `POST ECHO: Dummy ok` });
        }

    }

};

module.exports = BaseController;