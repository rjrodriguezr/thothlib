const { Schema, model } = require('mongoose');
const { modelAuditPlugin } = require('../middlewares');
const { movementTypes } = require('thothconst');

const InventoryMovementSchema = Schema({
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    product: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    warehouse: {
        type: Schema.Types.ObjectId,
        ref: 'Warehouse',
        required: true,
    },

    // --- INICIO DE LA CORRECCIÓN ARQUITECTÓNICA ---

    // ID del documento que origina el movimiento (polimórfico)
    source_document_id: {
        type: Schema.Types.ObjectId,
        required: true,
    },
    // Nombre del Modelo del documento de origen (ej: 'InventoryAdjustment', 'SaleOrder')
    source_document_type: {
        type: String,
        required: true,
    },
    // El tipo de movimiento ahora es más descriptivo y no se limita a ajustes
    type: {
        type: String,
        enum: Object.values(movementTypes),
        required: true,
    },
    
    // --- FIN DE LA CORRECCIÓN ARQUITECTÓNICA ---

    quantity_change: {
        type: Number,
        required: true,
    },
    stock_before: {
        type: Number,
        required: true,
    },
    stock_after: {
        type: Number,
        required: true,
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
});

InventoryMovementSchema.plugin(modelAuditPlugin);
// Creamos un índice sobre los campos polimórficos para poder buscar
// todos los movimientos originados por un documento específico.
InventoryMovementSchema.index({ source_document_id: 1, source_document_type: 1 });

// El índice principal para consultar el historial de un producto no cambia.
InventoryMovementSchema.index({ product: 1, warehouse: 1, executed_at: -1 });


module.exports = model('InventoryMovement', InventoryMovementSchema);