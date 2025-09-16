const logger = require('../../lib/logger');
const BaseService = require('../services/BaseService');
class BaseController {

    /**
     * Crea una instancia de BaseController.
     * @param {BaseService} service - Una instancia de un servicio que hereda de BaseService.
     */
    constructor(service) {
        if (!service || !(service instanceof BaseService)) {
            throw new Error('A service instance inheriting from BaseService must be provided to the BaseController constructor.');
        }
        this.service = service;
        this.modelName = service.model.modelName;

        // Envolvemos los métodos públicos en el manejador de errores asíncrono.
        // Esto centraliza la gestión de excepciones y limpia los métodos del controlador.
        // Usamos .bind(this) para asegurar que 'this' dentro de los métodos siga siendo la instancia del controlador.
        this.insert = this._catchAsync(this.insert.bind(this), 'inserting');
        this.get = this._catchAsync(this.get.bind(this), 'fetching');
        this.delete = this._catchAsync(this.delete.bind(this), 'deleting');
        this.update = this._catchAsync(this.update.bind(this), 'updating');
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
                // Determina si hay un ID de recurso en los parámetros de la ruta (ej. /recurso/:_id)
                const resourceId = req.params._id || null;
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
        const logMessage = `Error ${action} ${this.modelName}${resourceInfo}`;
        const clientMessage = `Error ${action} ${this.modelName}`;

        // Manejo específico para métodos no implementados en clases hijas
        if (error.message.includes('not implemented')) {
            logger.error(`Method for action '${action}' is not implemented in the derived controller for ${this.modelName}.`, error);
            return res.status(501).json({ message: `Functionality for '${action}' is not implemented.` });
        }

        logger.error(logMessage, error);
        logger.debug(error.stack);

        // The service layer throws an error containing "not found" for 404 cases
        const isNotFound = error.message.toLowerCase().includes('not found');
        const statusCode = isNotFound ? 404 : 500;

        res.status(statusCode).json({ message: clientMessage, error: error.message });
    }

    /**
     * Inserta un nuevo recurso utilizando el servicio base.
     */
    async insert(req, res) {
        const { companyId, username } = req.token;
        const newObject = await this.service.insert(companyId, username, req.body);
        res.status(201).json(newObject);
    }

    /**
     * Obtiene recursos. Si se proporciona un ID en la ruta, busca un único documento.
     * De lo contrario, devuelve una lista paginada.
     */
    async get(req, res) {
        const companyId = req.token.companyId;
        const { id } = req.params;
        const queryParams = req.query;

        let result;
        logger.trace({file: '[BaseController].get', companyId, id, queryParams});
        if (id) {
            // Si hay un id en los parámetros de la ruta, es una operación para un solo documento.
            // Pasamos el id dentro del objeto de consulta para que el servicio lo use.
            result = await this.service.selectOne(companyId, { ...queryParams, id });
        } else {
            // De lo contrario, es una operación para múltiples documentos.
            result = await this.service.selectAll(companyId, queryParams);
        }
        res.status(200).json(result);
    }

    /**
     * Realiza un borrado lógico (soft delete) de un recurso.
     */
    async delete(req, res) {
        const { companyId, username } = req.token;
        const { id } = req.params;
        const result = await this.service.delete(companyId, username, id);
        res.status(200).json(result);
    }

    /**
     * Actualiza un recurso existente.
     */
    async update(req, res) {
        const { companyId, username } = req.token;
        const { id } = req.params;
        logger.trace({file: '[BaseController].update', companyId, username, token: req.token,id, body: req.body});
        const result = await this.service.update(companyId, username, id, req.body);
        res.status(200).json(result);
    }
};

module.exports = BaseController;