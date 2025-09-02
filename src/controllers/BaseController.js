const logger = require('../../lib/logger');
const redisService = require('../../lib/redisService');

/**
 * BaseController
 * 
 * Clase base genérica para controladores CRUD sobre modelos de Mongoose.
 * Permite extender funcionalidades comunes como operaciones de inserción, actualización, eliminación y búsqueda.
 * 
 * Puede configurarse para que ciertas operaciones filtren automáticamente por el `company` asociado,
 * dependiendo de si la entidad debe estar ligada a una empresa (ej.: Productos) o ser global (ej.: Configuraciones generales).
 */
class BaseController {
    /**
     * Constructor de la clase BaseController
     * 
     * @param {mongoose.Model} model - El modelo de Mongoose que representa la colección a manipular.
     * 
     * Ejemplo de uso:
     *    const userController = new BaseController(UserModel, true); // Para usuarios ligados a un company
     *    const configController = new BaseController(ConfigModel, false); // Para configuraciones globales
     */
    constructor(model) {
        this.model = model;
    }

    async handleError(res, err, message) {
        logger.error(err);
        let cause = `Caused by: ${err.errorResponse?.errmsg || err.message}`;
        let msg = message ? `${message}. ${cause}` : cause;
        res.status(500).json({ message: msg });
    }

    _normalizeMatch(match) {
        for (let key in match) {
            if (match[key] === 'true') match[key] = true;
            if (match[key] === 'false') match[key] = false;
        }
        return match;
    }

    /**
     * @function insert
     * @description Inserta un nuevo documento en la base de datos.
     * Utiliza el modelo especificado para crear un nuevo registro con los datos enviados
     * en el cuerpo del request (`req.body`).
     *
     * @param {Object} req - Objeto de solicitud HTTP (Express).
     * @param {Object} res - Objeto de respuesta HTTP (Express).
     *
     * @returns {void} Responde con el documento creado o un error si ocurre.
     */
    async insert(req, res) {
        // authclient sube al request al request los datos del token {companyId, userId, username}
        if (!req.token) {
            return res.status(401).json({ message: "Token de autenticación no proporcionado." });
        }

        const { companyId, username } = req.token;

        if (!username) return res.status(401).json({ message: "username no proporcionado en el token de autenticación." });

        const payload = {
            ...req.body,
            created_by: username,
            modified_by: username
        };

        // CompanyId siempre debe agregarse a menos que no se requiera de forma explicita mediante la inyeccion del del atributo NotRequireCompanyFilter
        // entonces si no existe en el request -> !false -> true y se agrega companyId en el filtro
        // y si existe en el request -> !true -> false -> no se va a incluir companyId en el filtro
        if (!req.NotRequireCompanyFilter) {
            payload.company = companyId;
        }

        const doc = new this.model(payload);

        doc.save()
            .then(saved => {
                res.json({ status: 'saved', _id: saved._id })
            })
            // 🔥 Cambiado a función flecha para mantener el ambito donde fue creada y no de error con el this              
            .catch(err => {
                this.handleError(res, err, `${this.model.modelName} not created`);
            });
    }

    /**
     * @function get
     * @description Maneja una solicitud GET para obtener elementos desde la base de datos.
     * Retorna directamente una lista (array) con los resultados encontrados según los parámetros
     * enviados en la query del request.
     *
     * @param {Object} req - Objeto de solicitud HTTP (Express). Contiene la query con filtros.
     * @param {Object} res - Objeto de respuesta HTTP (Express). Usado para enviar la respuesta al cliente.
     *
     * @returns {void} Responde al cliente con un array JSON de los resultados o con un error si ocurre.
     */
    async get(req, res) {
        // Clona los parámetros del query
        let query = { ...req.query };

        // CompanyId siempre debe agregarse a menos que no se requiera de forma explicita mediante la inyeccion del del atributo NotRequireCompanyFilter
        // entonces si no existe en el request -> !false -> true y se agrega companyId en el filtro
        // y si existe en el request -> !true -> false -> no se va a incluir companyId en el filtro
        if (!req.NotRequireCompanyFilter) {
            // authclient sube al request al request los datos del token {companyId, userId, username}
            if (!req.token) {
                return res.status(401).json({ message: "Token de autenticación no proporcionado." });
            }
            const { companyId } = req.token;
            query.company = companyId;
        }

        // Extrae 'fields' del query y lo elimina del objeto de filtros
        const { fields, rediskey } = query;
        delete query.fields;
        delete query.rediskey;

        // Determinar si estamos buscando un elemento específico por ID
        const isSingleItemQuery = query._id !== undefined;

        // Construye la consulta
        let sql = this.model.find(this._normalizeMatch(query));

        // Si hay campos específicos, aplica proyección
        if (fields) {
            const projection = fields.replace(/,/g, ' ');
            sql = sql.select(projection);
        }

        // Ejecuta la consulta
        sql.exec()
            .then(async result => {
                // Si se proporcionó una rediskey y el resultado es válido, guardar en Redis
                if (rediskey && result) {
                    try {
                        // Guardar en Redis con un TTL de 1 hora (3600 segundos)
                        await redisService.setData(rediskey, result, ['EX', 3600]);
                        logger.verbose(`Resultado para la clave '${rediskey}' cacheado en Redis.`);
                    } catch (redisErr) {
                        // No bloquear la respuesta si Redis falla, solo registrar el error
                        logger.error(`Error al cachear el resultado en Redis para la clave '${rediskey}':`, redisErr);
                    }
                }

                if (isSingleItemQuery && result.length === 1) {
                    res.json(result[0]);
                } else {
                    res.json(result);
                }
            })
            .catch(err => {
                this.handleError(res, err, `${this.model.modelName} not found`);
            });
    }

    /**
     * @function delete
     * @description Desactiva lógicamente un documento (soft delete) usando _id y company como filtro.
     * Utiliza .save() para asegurar que se disparen los hooks definidos como pre('save').
     *
     * @param {Object} req - Objeto de solicitud HTTP (Express).
     * @param {Object} res - Objeto de respuesta HTTP (Express).
     *
     * @returns {void} Responde con el documento actualizado o un error.
     */
    async delete(req, res) {
        // authclient sube al request al request los datos del token {companyId, userId, username}
        if (!req.token) {
            return res.status(401).json({ message: "Token de autenticación no proporcionado." });
        }
        const { id } = req.params;
        const { companyId, username } = req.token;


        // Construye el filtro para asegurarnos que el usuario elimina un registro para la company a la que pertence
        const filter = { _id: id };

        // CompanyId siempre debe agregarse a menos que no se requiera de forma explicita mediante la inyeccion del del atributo NotRequireCompanyFilter
        // entonces si no existe en el request -> !false -> true y se agrega companyId en el filtro
        // y si existe en el request -> !true -> false -> no se va a incluir companyId en el filtro
        if (!req.NotRequireCompanyFilter) {
            filter.company = companyId;
        }

        try {
            const doc = await this.model.findOne(filter);
            if (!doc) {
                return res.status(404).json({ message: `${this.model.modelName} not found` });
            }

            doc.active = false;
            doc.modified_by = username;
            const saved = await doc.save(); // Dispara los hooks
            logger.info({ status: 'deleted', deleted: saved._id });
            res.json({ status: 'deleted', deleted: saved._id });
        } catch (err) {
            this.handleError(res, err, `${this.model.modelName} not deleted`);
        }
    }

    /**
     * @function update
     * @description Actualiza un documento usando _id y company como filtro.
     * Utiliza .save() para asegurar ejecución de pre('save') hooks.
     *
     * @param {Object} req - Objeto de solicitud HTTP (Express).
     * @param {Object} res - Objeto de respuesta HTTP (Express).
     *
     * @returns {void} Responde con el documento actualizado o un error.
     */
    async update(req, res) {
        // authclient sube al request al request los datos del token {companyId, userId, username}
        if (!req.token) {
            return res.status(401).json({ message: "Token de autenticación no proporcionado." });
        }
        const { id } = req.params;
        // authclient sube al request al request los datos del token {companyId, userId, username}
        const { companyId, username } = req.token;
        const updates = { ...req.body };

        const filter = { _id: id };
        // CompanyId siempre debe agregarse a menos que no se requiera de forma explicita mediante la inyeccion del del atributo NotRequireCompanyFilter
        // entonces si no existe en el request -> !false -> true y se agrega companyId en el filtro
        // y si existe en el request -> !true -> false -> no se va a incluir companyId en el filtro
        if (!req.NotRequireCompanyFilter) {
            filter.company = companyId;
        }

        try {
            const doc = await this.model.findOne(filter);
            if (!doc) {
                return res.status(404).json({ message: `${this.model.modelName} not found` });
            }

            // Actualizar propiedades dinámicamente
            Object.assign(doc, updates);
            doc.modified_by = username;

            const saved = await doc.save(); // Dispara hooks como pre('save')
            logger.info({ status: 'updated', updated: saved._id });
            res.json({ status: 'updated', updated: saved._id });
        } catch (err) {
            this.handleError(res, err, `${this.model.modelName} not updated`);
        }
    }

    async echo(req, res) {
        // authclient sube al request al request los datos del token {companyId, userId, username}
        const { companyId, username, userId } = req.token;
        logger.info({ companyId, username, userId });
        try {
            if (req.method === "GET") {
                res.json({ message: `GET ECHO: Dummy ok` });
            } else {
                res.json({ message: `POST ECHO: Dummy ok` });
            }
        } catch (error) {
            logger.error(error.stack)
            return res.status(500).json({
                error: error.message
            })
        }

    }

};

module.exports = BaseController;