const BaseService = require('./BaseService');

class CompanyScopedService extends BaseService {
    constructor(model) {
        super(model);
        // Identifica si el servicio está manejando el modelo 'Company' para aplicar lógica especial.
        this.isCompanyModel = this.model.modelName === 'Company';
    }

    /**
     * Sobrescribe _buildFilter para inyectar el companyId.
     * @override
     */
    _buildFilter(companyId, query) {
        const filter = super._buildFilter(query); // Llama a la lógica base

        // Si el filtro base ya contiene $and, añadimos la cláusula de compañía ahí.
        // De lo contrario, la añadimos directamente al filtro.
        if (companyId && !this.isCompanyModel) {
            if (filter.$and) {
                filter.$and.push({ company: companyId });
            } else {
                filter.company = companyId;
            }
        }
        return filter;
    }

    /**
   * Sobrescribe _buildQuery para pasar el companyId al constructor de filtros.
     * @override
     */
    _buildQuery(companyId, query, methodName) {
        // 1. Construimos el filtro con el ámbito de la compañía.
        const filter = this._buildFilter(companyId, query);

        // 2. Llamamos al _buildQuery de la clase base para obtener la consulta con la proyección y el populate.
        //    Le pasamos el `query` original para que pueda extraer `fields` y `populate`.
        const { query: baseQuery } = super._buildQuery(query, methodName);

        // 3. Reemplazamos el filtro de la consulta base con nuestro filtro modificado.
        baseQuery.setQuery(filter);
        return { query: baseQuery, filter };
    }

    // Los métodos selectAll y selectOne no necesitan ser sobrescritos,
    // ya que la lógica de _buildQuery que ellos llaman ya está manejando el companyId.
    // BaseService.selectAll(companyId, query) -> this._buildQuery(companyId, query, 'find') -> this._buildFilter(companyId, query)
    // ¡La herencia funciona!

    async insert(companyId, username, body) {
        const payload = { ...body };
        if (companyId && !this.isCompanyModel) {
            payload.company = companyId;
        }
        // Pasamos companyId como null a la base, ya que lo hemos añadido al payload.
        return super.insert(null, username, payload);
    }

    async update(companyId, username, id, body) {
        // Aseguramos que la búsqueda del documento esté restringida por la compañía.
        const filter = { _id: id };
        if (companyId && !this.isCompanyModel) {
            filter.company = companyId;
        }
        // La lógica de BaseService.update no es segura para multi-tenant porque solo busca por _id.
        // Por eso, aquí buscamos el documento con el filtro seguro y luego llamamos a la lógica de guardado.
        const doc = await this.model.findOne(filter);
        if (!doc) {
            throw new Error(`${this.model.modelName} not found`);
        }
        // Ahora que tenemos el documento correcto, podemos usar la lógica de actualización de la base.
        // Sin embargo, BaseService.update vuelve a buscar, así que replicamos la parte final.
        Object.assign(doc, body);
        doc.modified_by = username;
        const saved = await doc.save();
        return { status: 'updated', updated: saved._id };
    }

    async delete(companyId, username, id) {
        // Similar a update, aseguramos que la búsqueda del documento esté restringida.
        const filter = { _id: id };
        if (companyId && !this.isCompanyModel) {
            filter.company = companyId;
        }
        const doc = await this.model.findOne(filter);
        if (!doc) {
            throw new Error(`${this.model.modelName} not found`);
        }
        // Replicamos la lógica final de borrado lógico.
        doc.active = false;
        doc.modified_by = username;
        const saved = await doc.save();
        return { status: 'deleted', deleted: saved._id };
    }
}

module.exports = CompanyScopedService;