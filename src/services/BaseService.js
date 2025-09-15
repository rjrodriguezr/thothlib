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
    _buildFilter(query) {
        const filter = { ...query }; // Clonar para no mutar el original
        // 1. Extraer términos de control y búsqueda
        const searchTerm = filter.search;

        // 2. Eliminar claves de control que no son parte del filtro del modelo
        delete filter.fields;
        delete filter.page;
        delete filter.limit;
        delete filter.sort;
        delete filter.populate; // Eliminar clave de populate para que no sea parte del filtro
        delete filter.search; // Importante eliminar 'search' para que no sea tratado como un campo de filtro

        const baseFilter = this._normalizeMatch(filter);

        // 3. Si no hay término de búsqueda, devolver el filtro base
        if (!searchTerm) {
            logger.trace({ function: '[_buildFilter].searchTerm', baseFilter });
            return baseFilter;
        }

        // 4. Determinar en qué campos buscar: siempre en todos los campos de tipo String del esquema.
        const schemaPaths = this.model.schema.paths;
        const fieldsToSearch = Object.keys(schemaPaths).filter(path =>
            schemaPaths[path].instance === 'String' &&
            !path.startsWith('_') && // Excluir __v, etc.
            !['company', 'created_by', 'modified_by'].includes(path) // Excluir campos de auditoría/relación
        );

        if (fieldsToSearch.length === 0) {
            logger.warn(`Se proporcionó el parámetro 'search' pero no se encontraron campos de tipo String para buscar en el modelo ${this.model.modelName}.`);
            return baseFilter; // No hay campos en los que buscar, devolver filtro base
        }

        // 5. Construir la condición $or para la búsqueda (case-insensitive)
        const orConditions = fieldsToSearch.map(field => ({
            [field]: { $regex: new RegExp(searchTerm, 'i') }
        }));

        // 6. Combinar el filtro base con la condición de búsqueda de forma robusta usando $and.
        // Esto asegura que las condiciones del filtro base y las condiciones de búsqueda (search)
        // se apliquen conjuntamente.
        const finalFilter = {};
        const andClauses = [];

        // Añadir el filtro base si no está vacío
        if (Object.keys(baseFilter).length > 0) {
            andClauses.push(baseFilter);
        }
        // Añadir la condición de búsqueda
        andClauses.push({ $or: orConditions });

        finalFilter.$and = andClauses;
        logger.trace({ function: '[_buildFilter].finalFilter', finalFilter });
        return finalFilter;
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
    _buildQuery(query, methodName) {
        // Construye el filtro base
        const filter = this._buildFilter(query);

        // Construye la consulta base usando el método especificado ('find' o 'findOne')
        let sql = this.model[methodName](filter);

        // Define la proyección
        let projection;
        if (query.fields) {
            // Si el usuario especifica campos, se respeta su selección.
            projection = query.fields.replace(/,/g, ' ');
        } else {
            // Por defecto, se excluyen los campos de auditoría y estado.
            projection = '-active -created_by -created_at -modified_by -modified_at';
        }
        sql = sql.select(projection);

        // --- Lógica para POPULATE (Poblar Referencias) ---
        // Esta sección permite poblar campos de referencia de Mongoose (ObjectId refs)
        // con los datos del documento referenciado, directamente desde la consulta.
        if (query.populate) {
            // El parámetro `populate` en la URL debe seguir un formato específico:
            // - Para una sola referencia: `?populate=path:campo1,campo2`
            //   Ejemplo: `?populate=template:name,status`
            // - Para múltiples referencias, se separan con `|`:
            //   Ejemplo: `?populate=template:name|created_by:username,email`
            //
            // 1. Separar cada instrucción de populate.
            // "template:name,status|user:username" -> ["template:name,status", "user:username"]
            const populateInstructions = query.populate.split('|');

            populateInstructions.forEach(instruction => {
                // 2. Separar el path de los campos a seleccionar.
                // "template:name,status" -> ["template", "name,status"]
                const parts = instruction.split(':');
                const path = parts[0];
                // 3. Preparar la cadena de selección de campos. Mongoose espera un string separado por espacios.
                // "name,status" -> "name status"
                const select = parts[1] ? parts[1].replace(/,/g, ' ') : '';

                // 4. Construir el objeto de opciones para el método .populate() de Mongoose.
                // Si `select` está vacío, se traerá el documento completo.
                // Si `select` tiene campos, solo se traerán esos campos (además del _id).
                const populateOptions = { path };
                if (select) {
                    populateOptions.select = select;
                }
                // 5. Aplicar la instrucción de populate a la consulta.
                sql = sql.populate(populateOptions);
            });
        }
        return { query: sql, filter };
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
        // 1. Opciones de paginación y ordenamiento (companyId se ignora aquí, se manejará en la subclase)
        const page = parseInt(query.page, 10) || 1;
        const limit = parseInt(query.limit, 10) || 10;
        const skip = (page - 1) * limit;
        const sortOrder = query.sort ? query.sort.replace(/,/g, ' ') : '-createdAt';


        // 2. Construir la consulta principal y la de conteo
        const { query: findQuery, filter } = this._buildQuery(query, 'find');

        // Decide si usar .lean() basado en una opción personalizada del esquema.
        // Por defecto se usa .lean() para mejor rendimiento.
        // Modelos como Customer y User pueden desactivarlo con `useLean: false` en sus opciones de esquema
        // para asegurar que los getters (ej. desencriptación) se apliquen.
        const schemaOptions = this.model.schema.options || {};
        const shouldUseLean = schemaOptions.useLean !== false;

        let queryToExecute = findQuery
            .sort(sortOrder)
            .skip(skip)
            .limit(limit);

        if (shouldUseLean) {
            queryToExecute = queryToExecute.lean();
        }

        // 3. Ejecutar consultas en paralelo para eficiencia
        const [docs, totalDocs] = await Promise.all([
            queryToExecute.exec(),
            this.model.countDocuments(filter)
        ]);

        // 4. Calcular metadatos de paginación
        const totalPages = Math.ceil(totalDocs / limit);

        // Reemplaza el bucle por un resumen más eficiente y útil.
        logger.trace({
            file: '[BaseService].selectAll',
            message: `Found ${docs.length} documents of ${totalDocs} total.`,
            pagination: { page, limit, totalPages }
        });

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
     * @returns {Promise<object|null>} Devuelve el documento que coincida con la consulta, o `null` si no se encuentra ninguno.
     * @throws {Error} Lanza una excepción si ocurre un error en la base de datos.
     * El llamador es responsable de capturar y manejar esta excepción.
     */
    async selectOne(companyId, query) {
        const { query: findOneQuery } = this._buildQuery(query, 'findOne');

        // Decide si usar .lean() basado en una opción personalizada del esquema.
        const schemaOptions = this.model.schema.options || {};
        const shouldUseLean = schemaOptions.useLean !== false;

        let queryToExecute = findOneQuery;

        if (shouldUseLean) {
            queryToExecute = queryToExecute.lean();
        }

        const result = await queryToExecute.exec();
        return result;
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

        const doc = new this.model(payload);

        const saved = await doc.save();
        return { status: 'saved', _id: saved._id };

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

        const filter = { _id: id }; // El filtrado por compañía se hará en la subclase
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

        const filter = { _id: id }; // El filtrado por compañía se hará en la subclase

        const doc = await this.model.findOne(filter);
        if (!doc) throw new Error(`${this.model.modelName} not found`);

        doc.active = false;
        doc.modified_by = username;
        const saved = await doc.save(); // Dispara los hooks
        logger.info({ status: 'deleted', deleted: saved._id });
        return { status: 'deleted', deleted: saved._id };
    }

};

module.exports = BaseService;