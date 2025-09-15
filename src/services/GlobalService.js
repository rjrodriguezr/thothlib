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

    // No se necesita sobrescribir ningún método.
    // Usará la implementación neutral de BaseService.
}

module.exports = GlobalService;
