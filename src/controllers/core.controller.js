const logger = require('../../lib/logger');
const CoreService = require('../services/core.service');

class CoreController {
    /**
     * Creates an instance of CoreController.
     * @param {CoreService} service - An instance of CoreService.
     * @throws {Error} If the service is not an instance of CoreService.
     */
    constructor(service) {
        if (!(service instanceof CoreService)) {
            throw new Error('CoreController requires an instance of CoreService');
        }
        this.service = service;
    }

    _handleError(error, res) {
        logger.error(error);
        let status = 500;
        if (error.name === 'ValidationError') {
            status = 400;
        } else if (error.code === 11000) {
            status = 409;
        } else if (error.name === 'CastError') {
            status = 400;
        }

        return res.status(status).json({
            status: 'error',
            message: error.message
        });
    }

    _catchAsync(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch((err) => this._handleError(err, res));
        };
    }

    /**
     * Retrieves a resource by ID or a list of resources.
     * If `req.params.id` is present, fetches a single document.
     * Otherwise, fetches all documents matching `req.query`.
     * @param {Object} req - The request object.
     * @param {Object} res - The response object.
     */
    get = this._catchAsync(async (req, res) => {
        logger.debug(`[CoreController] Executing get with params: ${JSON.stringify(req.params)} and query: ${JSON.stringify(req.query)}`);
        const { id } = req.params;
        if (id) {
            const result = await this.service.findById(id);
            if (!result) {
                return res.status(404).json({ status: 'error', message: 'Document not found' });
            }
            return res.status(200).json(result);
        }

        const result = await this.service.findAll(req.query);
        res.status(200).json(result);
    });

    /**
     * Creates a new resource.
     * Injects `created_by` and `updated_by` if `req.user.username` is present.
     * @param {Object} req - The request object.
     * @param {Object} res - The response object.
     */
    post = this._catchAsync(async (req, res) => {
        logger.debug(`[CoreController] Executing post with body: ${JSON.stringify(req.body)}`);
        const body = req.body;
        if (req.user && req.user.username) {
            body.created_by = req.user.username;
            body.updated_by = req.user.username;
        }
        const result = await this.service.create(body);
        res.status(201).json(result);
    });

    /**
     * Updates an existing resource by ID.
     * Injects `updated_by` if `req.user.username` is present and updates `updated_at`.
     * @param {Object} req - The request object.
     * @param {Object} res - The response object.
     */
    put = this._catchAsync(async (req, res) => {
        logger.debug(`[CoreController] Executing put with params: ${JSON.stringify(req.params)} and body: ${JSON.stringify(req.body)}`);
        const { id } = req.params;
        const body = req.body;

        body.updated_at = Date.now();
        if (req.user && req.user.username) {
            body.updated_by = req.user.username;
        }

        const result = await this.service.update(id, body);
        if (!result) {
            return res.status(404).json({ status: 'error', message: 'Document not found' });
        }
        res.status(200).json(result);
    });

    /**
     * Deletes a resource by ID.
     * @param {Object} req - The request object.
     * @param {Object} res - The response object.
     */
    delete = this._catchAsync(async (req, res) => {
        logger.debug(`[CoreController] Executing delete with params: ${JSON.stringify(req.params)}`);
        const { id } = req.params;
        const result = await this.service.delete(id);
        if (!result) {
            return res.status(404).json({ status: 'error', message: 'Document not found' });
        }
        res.status(200).json(result);
    });
}

module.exports = CoreController;