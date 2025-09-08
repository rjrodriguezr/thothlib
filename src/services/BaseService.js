const logger = require("../../lib/logger");
const redisService = require("../../lib/redisService");
class BaseService {
    constructor(model) {
        this.model = model;
    }

    async handleError(err, message) {
        logger.error(err);
        let cause = `Caused by: ${err.errorResponse?.errmsg || err.message}`;
        let msg = message ? `${message}. ${cause}` : cause;
        return msg;
    }

    _normalizeMatch(match) {
        for (let key in match) {
            if (match[key] === 'true') match[key] = true;
            if (match[key] === 'false') match[key] = false;
        }
        return match;
    }

    async insert(companyId, username, body) {

        if (!username) throw new Error("username no proporcionado.");

        const payload = {
            ...body,
            created_by: username,
            modified_by: username
        };

        if (companyId) {
            payload.company = companyId;
        }

        const doc = new this.model(payload);

        try {
            const saved = await doc.save();
            return { status: 'saved', _id: saved._id };
        } catch (err) {
            throw new Error(await this.handleError(err, `${this.model.modelName} not created`));
        }

    }

    async get(query) {
        // Clona los parámetros del query
        let match = { ...query };

        // Extrae 'fields' del query y lo elimina del objeto de filtros
        const { fields, redisKey } = match;
        delete match.fields;
        delete match.redisKey;

        // Determinar si estamos buscando un elemento específico por ID
        const isSingleItemQuery = match._id !== undefined;

        try {
            // Construye la consulta
            let sql = this.model.find(this._normalizeMatch(match));

            // Si hay campos específicos, aplica proyección
            if (fields) {
                const projection = fields.replace(/,/g, ' ');
                sql = sql.select(projection);
            }

            // Ejecuta la consulta
            const result = await sql.exec();

            if (isSingleItemQuery && result.length === 1) {
                return result[0];
            } else {
                // Si se proporcionó una rediskey y el resultado es válido, guardar en Redis
                if (redisKey && result) {
                    // Ejecutar en segundo plano (fire-and-forget) sin esperar para no bloquear la respuesta.
                    redisService.setData(redisKey, result, ['EX', 3600])
                        .then(() => logger.verbose(`Resultado para la clave '${redisKey}' cacheado en Redis.`))
                        .catch(redisErr => logger.error(`Error al cachear el resultado en Redis para la clave '${redisKey}':`, redisErr));
                }
                return result;
            }

        } catch (err) {
            throw new Error(await this.handleError(err, `${this.model.modelName} not found`));
        }
    }

    async delete(companyId, username, id) {
        if (!username) throw new Error("Username not provided in the authentication token.");

        const filter = { _id: id };
        if (companyId) filter.company = companyId;

        try {
            const doc = await this.model.findOne(filter);
            if (!doc) throw new Error(`${this.model.modelName} not found`);

            doc.active = false;
            doc.modified_by = username;
            const saved = await doc.save(); // Dispara los hooks
            logger.info({ status: 'deleted', deleted: saved._id });
            return { status: 'deleted', deleted: saved._id };
        } catch (err) {
            throw new Error(await this.handleError(err, `${this.model.modelName} not deleted`));
        }
    }

    /**
     * @function update
     * @description Actualiza un documento usando _id y company como filtro.
     * Utiliza .save() para asegurar ejecución de pre('save') hooks.
     *
     * @param {string} companyId - ID de la compañía.
     * @param {string} username - Nombre de usuario que realiza la modificación.
     * @param {Object} body - Cuerpo de la solicitud con los datos a actualizar, debe incluir el 'id'.
     *
     * @returns {Object} Objeto con el estado de la operación.
     */
    async update(companyId, username,id, body) {
        const updates = { ...body };
        
        const filter = { _id: id };
        if (companyId) {
            filter.company = companyId;
        }

        try {
            const doc = await this.model.findOne(filter);
            if (!doc) {
                throw new Error(`${this.model.modelName} not found`);
            }
            Object.assign(doc, updates);
            doc.modified_by = username;
            const saved = await doc.save(); // Dispara hooks como pre('save')
            logger.info({ status: 'updated', updated: saved._id });
            return { status: 'updated', updated: saved._id };
        } catch (err) {
            throw new Error(await this.handleError(err, `${this.model.modelName} not updated`));
        }
    }
};

module.exports = BaseService;