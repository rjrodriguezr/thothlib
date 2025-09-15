// Crear un nuevo archivo: g:\Usuarios\Ricardo\Desktop\Node\thothlib\src\services\GlobalService.js

const BaseService = require('./BaseService');

/**
 * Servicio para entidades globales que no están asociadas a una compañía.
 * Hereda toda la funcionalidad CRUD de BaseService sin añadir la lógica de companyId.
 */
class GlobalService extends BaseService {
    constructor(model) {
        super(model);
    }

    /**
     * Sobrescribe selectAll para alinear la firma del método con la llamada desde BaseController.
     * Ignora el companyId y pasa los argumentos correctos a la clase base.
     * @param {string | undefined | null} companyId - El ID de la compañía (ignorado).
     * @param {object} query - El objeto de consulta.
     */
    async selectAll(companyId, query) {
        // Llama al método de la clase base con los parámetros en el orden correcto, ignorando companyId.
        return super.selectAll(query);
    }

    /**
     * Sobrescribe selectOne para alinear la firma del método con la llamada desde BaseController.
     * Ignora el companyId y pasa los argumentos correctos a la clase base.
     * @param {string | undefined | null} companyId - El ID de la compañía (ignorado).
     * @param {object} query - El objeto de consulta.
     */
    async selectOne(companyId, query) {
        return super.selectOne(query);
    }
}

module.exports = GlobalService;
