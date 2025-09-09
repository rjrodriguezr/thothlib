const logger = require("../../lib/logger");
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
     * Construye una consulta de Mongoose basada en los parámetros de filtrado y proyección.
     * Este método centraliza la lógica común para `selectAll` y `selectOne`.
     *
     * @param {string | undefined | null} companyId - El ID de la compañía para filtrar.
     * @param {object} query - El objeto de consulta original.
     * @param {string} methodName - El nombre del método de Mongoose a utilizar ('find' o 'findOne').
     * @returns {mongoose.Query} La consulta de Mongoose construida.
     * @private
     */
    _buildQuery(companyId, query, methodName) {
        // Clona los parámetros del query para no mutar el objeto original
        const match = { ...query };

        if (companyId) {
            match.company = companyId;
        }

        // Extrae 'fields' del query y lo elimina del objeto de filtros
        const { fields } = match;
        delete match.fields;

        // Construye la consulta base usando el método especificado ('find' o 'findOne')
        let sql = this.model[methodName](this._normalizeMatch(match));

        // Si hay campos específicos, aplica proyección
        if (fields) {
            const projection = fields.replace(/,/g, ' ');
            sql = sql.select(projection);
        }

        return sql;
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
     * Permite filtrar y seleccionar campos específicos (proyección).
     *
     * @param {string | undefined | null} companyId - El ID de la compañía para filtrar los resultados. Si es `undefined` o `null`, no se aplica filtro por compañía.
     * @param {object} query - Objeto de consulta que puede contener:
     * @param {object} query - ...filtros adicionales para la consulta de Mongoose (ej. `{ active: true }`).
     * @param {string} [query.fields] - Una cadena de campos separados por comas para la proyección (ej. 'name,email').
     * @returns {Promise<Array<object>>} Devuelve un array de objetos.
     * @throws {Error} Lanza una excepción si ocurre un error durante la consulta a la base de datos.
     * El llamador es responsable de capturar y manejar esta excepción.
     */
    async selectAll(companyId, query) {
        const sql = this._buildQuery(companyId, query, 'find');
        return sql.exec();
    }

    /**
     * Obtiene un único documento de la base de datos.
     * Se utiliza para consultas que se espera que devuelvan un solo resultado.
     *
     * @param {string | undefined | null} companyId - El ID de la compañía para filtrar los resultados. Si es `undefined` o `null`, no se aplica filtro por compañía.
     * @param {object} query - Objeto de consulta con los filtros para encontrar el documento (ej. `{ email: 'test@test.com' }`).
     * @param {string} [query.fields] - Una cadena de campos separados por comas para la proyección (ej. 'name,email').
     * @returns {Promise<object|null>} Devuelve el primer documento que coincida con la consulta, o `null` si no se encuentra ninguno.
     * @throws {Error} Lanza una excepción si ocurre un error en la base de datos.
     * El llamador es responsable de capturar y manejar esta excepción.
     */
    async selectOne(companyId, query) {
        const sql = this._buildQuery(companyId, query, 'findOne');
        return sql.exec();
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