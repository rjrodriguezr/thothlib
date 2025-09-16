const logger = require('../../lib/logger');
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

    // Los métodos selectAll y selectOne deben ser sobrescritos para pasar el companyId
    // a la lógica de construcción de filtros.

    async selectAll(companyId, query) {
        // Construimos el filtro con el companyId antes de llamar a la lógica base.
        const filter = this._buildFilter(companyId, query);
        // Llamamos al selectAll de la clase base, pero le pasamos el filtro ya construido.
        return super.selectAll(query, filter);
    }

    async selectOne(companyId, query) {
        // Hacemos lo mismo para selectOne.
        const filter = this._buildFilter(companyId, query);
        return super.selectOne(query, filter);
    }

    // _buildQuery ya no necesita ser sobrescrito porque la lógica de filtrado
    // se maneja en los métodos públicos (selectAll, selectOne).
    // La versión de BaseService._buildQuery será utilizada directamente.


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