const logger = require("../../lib/logger");
const redisService = require("../../lib/redisService");
class BaseService {
    /**
     * Crea una instancia de BaseService.
     * @param {mongoose.Model} model - El modelo de Mongoose con el que operará el servicio.
     */
    constructor(model) {
        this.model = model;
    }

    /**
     * Normaliza los valores de un objeto de filtro.
     * Convierte los strings 'true' y 'false' a sus equivalentes booleanos.
     * @param {object} match - El objeto de filtro a normalizar.
     * @returns {object} El objeto de filtro con los valores normalizados.
     * @private
     */
    _normalizeMatch(match) {
        for (let key in match) {
            if (match[key] === 'true') match[key] = true;
            if (match[key] === 'false') match[key] = false;
        }
        return match;
    }

    /**
     * Inserta un nuevo documento en la base de datos.
     * Asigna automáticamente los campos `created_by` y `modified_by`.
     * Asocia el documento a una compañía si se proporciona un `companyId`.
     *
     * @param {string | undefined | null} companyId - El ID de la compañía a la que pertenece el documento.
     * Puede ser `undefined` o `null` para documentos que no pertenecen a una compañía específica (ej. recursos globales del sistema).
     * @param {string} username - El nombre de usuario que realiza la operación, usado para auditoría.
     * @param {object} body - El cuerpo del documento a crear.
     * @returns {Promise<{status: string, _id: any}>} Un objeto indicando el éxito y el ID del nuevo documento.
     * @throws {Error} Lanza una excepción si ocurre un error durante el guardado (ej. error de validación de Mongoose).
     * El llamador es responsable de capturar y manejar esta excepción.
     */
    async insert(companyId, username, body) {
        const payload = {
            ...body,
            created_by: username,
            modified_by: username
        };

        if (companyId) {
            payload.company = companyId;
        }

        const doc = new this.model(payload);

        const saved = await doc.save();
        return { status: 'saved', _id: saved._id };

    }

    /**
     * Obtiene uno o más documentos de la base de datos.
     * Permite filtrar, seleccionar campos específicos (proyección) y cachear los resultados en Redis.
     *
     * @param {object} query - Objeto de consulta que puede contener:
     * @param {object} query - ...filtros para la consulta de Mongoose (ej. `{ active: true }`). El filtrado por compañía
     * debe incluirse aquí como `query.company = companyId` si es necesario.
     * @param {string} [query.fields] - Una cadena de campos separados por comas para la proyección (ej. 'name,email').
     * @param {string} [query.redisKey] - Una clave de Redis opcional. Si se proporciona, el resultado se cacheará bajo esta clave.
     * @returns {Promise<object|Array<object>>} Devuelve un único objeto si la consulta incluye `_id`, o un array de objetos en caso contrario.
     * @throws {Error} Lanza una excepción si ocurre un error durante la consulta a la base de datos.
     * El llamador es responsable de capturar y manejar esta excepción.
     */
    async get(query) {
        // Clona los parámetros del query
        let match = { ...query };

        // Extrae 'fields' del query y lo elimina del objeto de filtros
        const { fields, redisKey } = match;
        delete match.fields;
        delete match.redisKey;

        // Determinar si estamos buscando un elemento específico por ID
        const isSingleItemQuery = match._id !== undefined;

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

    }

    /**
     * Realiza un borrado lógico (soft delete) de un documento, estableciendo su campo `active` a `false`.
     *
     * @param {string | undefined | null} companyId - El ID de la compañía. Si se proporciona, la operación solo
     * afectará a documentos que pertenezcan a esa compañía, añadiendo una capa de seguridad en un entorno multi-tenant.
     * Si es `undefined` o `null`, el documento se buscará solo por su `id`, lo cual es útil para recursos que no están ligados a una compañía.
     * @param {string} username - El nombre de usuario que realiza la operación, para auditoría.
     * @param {string} id - El ID del documento a eliminar.
     * @returns {Promise<{status: string, deleted: any}>} Un objeto indicando el éxito y el ID del documento eliminado.
     * @throws {Error} Lanza una excepción si el documento no se encuentra o si ocurre un error durante el guardado.
     * El llamador es responsable de capturar y manejar esta excepción.
     */
    async delete(companyId, username, id) {

        const filter = { _id: id };
        if (companyId) filter.company = companyId;

        const doc = await this.model.findOne(filter);
        if (!doc) throw new Error(`${this.model.modelName} not found`);

        doc.active = false;
        doc.modified_by = username;
        const saved = await doc.save(); // Dispara los hooks
        logger.info({ status: 'deleted', deleted: saved._id });
        return { status: 'deleted', deleted: saved._id };
    }

    /**
     * Actualiza un documento existente en la base de datos.
     *
     * @param {string | undefined | null} companyId - El ID de la compañía. Si se proporciona, la búsqueda del documento
     * se restringirá a esa compañía, previniendo actualizaciones no autorizadas en un sistema multi-tenant.
     * Si es `undefined` o `null`, el documento se buscará solo por su `id`.
     * @param {string} username - El nombre de usuario que realiza la actualización, para auditoría.
     * @param {string} id - El ID del documento a actualizar.
     * @param {object} body - Un objeto con los campos y valores a actualizar.
     * @returns {Promise<{status: string, updated: any}>} Un objeto indicando el éxito y el ID del documento actualizado.
     * @throws {Error} Lanza una excepción si el documento no se encuentra o si ocurre un error durante el guardado (ej. validación).
     * El llamador es responsable de capturar y manejar esta excepción.
     */
    async update(companyId, username, id, body) {
        const updates = { ...body };

        const filter = { _id: id };
        if (companyId) {
            filter.company = companyId;
        }

        const doc = await this.model.findOne(filter);
        if (!doc) {
            throw new Error(`${this.model.modelName} not found`);
        }
        Object.assign(doc, updates);
        doc.modified_by = username;
        const saved = await doc.save(); // Dispara hooks como pre('save')
        logger.info({ status: 'updated', updated: saved._id });
        return { status: 'updated', updated: saved._id };

    }
};

module.exports = BaseService;