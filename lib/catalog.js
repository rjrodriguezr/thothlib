const logger = require('./logger');
const DEFAULT_ROLES = {
    CUSTOMER_ADMIN_ROLE: 'admin', // Rol de usuario estándar
    SYSTEM_ADMIN_ROLE: 'system', // Rol de administrador
    USER_ROLE: 'user', // Rol de administrador del sistema (parece que ya lo usas)
    VIEWER_ROLE: 'viewer'
    // Agrega cualquier otro rol esencial que necesites por defecto
};

// Objetos separados para cada tipo de constante
const CURRENCY = {};
const QUOTATION_STATUS = {};
const ROL = {...DEFAULT_ROLES};
const STOCK_STATUS = {};
const UNITS_OF_MEASURE = {};
const UNITS_OF_MEASURE_CATEGORIES = {};

/**
 * Mapea el 'type' del documento a su objeto de constante correspondiente.
 */
const constantsMap = {
    CURRENCY: CURRENCY,
    QUOTATION_STATUS: QUOTATION_STATUS,
    ROL: ROL,
    STOCK_STATUS: STOCK_STATUS,
    UNITS_OF_MEASURE_CATEGORIES: UNITS_OF_MEASURE_CATEGORIES,
    UNITS_OF_MEASURE: UNITS_OF_MEASURE,
    // Añade aquí más tipos si los tienes en tu colección
};

const loadCatalog = async (conn) => {
    const catalogData = await conn.db.collection('setup_catalog').find({ active: true }).project({ _id: 0, type: 1, key: 1, value: 1 }).toArray();
    catalogData.forEach(item => {
        const targetObject = constantsMap[item.type];
        if (targetObject) {
            targetObject[item.key] = item.value;
        } else {
            logger.warn(`Tipo de constante desconocido: ${item.type}. Considera añadirlo a 'constantsMap'.`);
        }
    });
}

module.exports = {
    CURRENCY,
    loadCatalog,
    QUOTATION_STATUS,
    ROL,
    STOCK_STATUS,
    UNITS_OF_MEASURE_CATEGORIES,
    UNITS_OF_MEASURE,
};