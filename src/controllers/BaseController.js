const logger = require('../../lib/logger');
const BaseService = require('../services/BaseService');
class BaseController {

    /**
     * Crea una instancia de BaseController.
     * @param {mongoose.Model} model - El modelo de Mongoose para el cual este controlador manejará las operaciones CRUD.
     */
    constructor(model) {
        if (!model) {
            throw new Error('A Mongoose model must be provided to the BaseController constructor.');
        }
        this.service = new BaseService(model);
        this.modelName = model.modelName;

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
        const { companyId } = req.token;
        const { _id } = req.params;

        if (_id) {
            // Lógica para obtener un único recurso por ID
            // Pasamos los query params para permitir proyección de campos (fields)
            const query = { ...req.query, _id: _id };
            const result = await this.service.selectOne(companyId, query);
            res.status(200).json(result);
        } else {
            // Lógica para obtener una lista de recursos
            const result = await this.service.selectAll(companyId, req.query);
            res.status(200).json(result);
        }
    }

    /**
     * Realiza un borrado lógico (soft delete) de un recurso.
     */
    async delete(req, res) {
        const { companyId, username } = req.token;
        const { _id } = req.params;
        const result = await this.service.delete(companyId, username, _id);
        res.status(200).json(result);
    }

    /**
     * Actualiza un recurso existente.
     */
    async update(req, res) {
        const { companyId, username } = req.token;
        const { _id } = req.params;
        const result = await this.service.update(companyId, username, _id, req.body);
        res.status(200).json(result);
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