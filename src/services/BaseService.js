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
     * Construye el objeto de filtro base a partir del query, eliminando claves de control.
     *
     * @param {string | undefined | null} companyId - El ID de la compañía para filtrar.
     * @param {object} query - El objeto de consulta original.
     * @returns {object} El objeto de filtro para Mongoose.
     * @private
     */
    _buildFilter(companyId, query) {
        const filter = { ...query };
        if (companyId) {
            filter.company = companyId;
        }
        // Eliminar claves de control que no son parte del filtro del modelo
        delete filter.fields;
        delete filter.page;
        delete filter.limit;
        delete filter.sort;

        return this._normalizeMatch(filter);
    }

    /**
     * Construye una consulta de Mongoose basada en los parámetros de filtrado y proyección.
     * Este método centraliza la lógica común para `selectAll` y `selectOne`.
     *
     * @param {string | undefined | null} companyId - El ID de la compañía para filtrar.
     * @param {object} query - El objeto de consulta original.
     * @param {string} methodName - El nombre del método de Mongoose a utilizar ('find' o 'findOne').
     * @returns {{query: mongoose.Query, filter: object}} Un objeto con la consulta de Mongoose y el filtro utilizado.
     * @private
     */
    _buildQuery(companyId, query, methodName) {
        // Construye el filtro base
        const filter = this._buildFilter(companyId, query);

        // Construye la consulta base usando el método especificado ('find' o 'findOne')
        let sql = this.model[methodName](filter);

        // Si hay campos específicos, aplica proyección
        if (query.fields) {
            const projection = query.fields.replace(/,/g, ' ');
            sql = sql.select(projection);
        }

        return { query: sql, filter };
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
     * Obtiene una lista paginada de documentos de la base de datos.
     * Permite filtrar, ordenar, paginar y seleccionar campos específicos (proyección).
     *
     * @param {string | undefined | null} companyId - El ID de la compañía para filtrar los resultados. Si es `undefined` o `null`, no se aplica filtro por compañía.
     * @param {object} query - Objeto de consulta que puede contener:
     * @param {object} query - ...filtros adicionales para la consulta de Mongoose (ej. `{ active: true }`).
     * @param {string} [query.fields] - Una cadena de campos separados por comas para la proyección (ej. 'name,email').
     * @param {number} [query.page=1] - El número de página a recuperar.
     * @param {number} [query.limit=10] - El número de documentos por página.
     * @param {string} [query.sort='-createdAt'] - El campo y orden para ordenar (ej. 'name,-age').
     * @returns {Promise<object>} Devuelve un objeto con los resultados paginados y metadatos.
     * @throws {Error} Lanza una excepción si ocurre un error durante la consulta a la base de datos.
     * El llamador es responsable de capturar y manejar esta excepción.
     */
    async selectAll(companyId, query) {
        // 1. Opciones de paginación y ordenamiento
        const page = parseInt(query.page, 10) || 1;
        const limit = parseInt(query.limit, 10) || 10;
        const skip = (page - 1) * limit;
        const sortOrder = query.sort ? query.sort.replace(/,/g, ' ') : '-createdAt';


        // 2. Construir la consulta principal y la de conteo
        const { query: findQuery, filter } = this._buildQuery(companyId, query, 'find');
        logger.trace({file:'[BaseService].selectAll', page, limit, skip, sortOrder, filter });

        // 3. Ejecutar consultas en paralelo para eficiencia
        const [docs, totalDocs] = await Promise.all([
            findQuery
                .sort(sortOrder)
                .skip(skip)
                .limit(limit)
                .lean() // Usar lean() para mejor rendimiento en consultas de solo lectura
                .exec(),
            this.model.countDocuments(filter)
        ]);

        // 4. Calcular metadatos de paginación
        const totalPages = Math.ceil(totalDocs / limit);
        logger.trace({file:'[BaseService].selectAll', docs, totalDocs, totalPages });

        // 5. Devolver objeto de paginación
        return {
            docs,
            totalDocs,
            limit,
            page,
            totalPages,
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages,
        };
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
        const { query: sql } = this._buildQuery(companyId, query, 'findOne');
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