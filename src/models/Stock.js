const { Schema, model } = require('mongoose');

const StockSchema = Schema({
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: [true, 'Company reference is required'],
    },
    product: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product reference is required'],
    },
    warehouse: {
        type: Schema.Types.ObjectId,
        ref: 'Warehouse',
        required: [true, 'Warehouse reference is required'],
    },
    quantity: {
        type: Number,
        required: true,
        default: 0,
        min: [0, 'Stock quantity cannot be negative'],
    },
    // Punto de reorden para este producto en este almacén específico
    reorder_point: {
        type: Number,
        default: 0,
    },
}); // timestamps para saber cuándo se actualizó el stock por última vez

// Aplicar plugin de auditoría
StockSchema.plugin(modelAuditPlugin);
// Índice principal para búsquedas rápidas de stock.
// Debe ser único para evitar duplicados de un mismo producto en un mismo almacén.
StockSchema.index({ product: 1, warehouse: 1 }, { unique: true });

// Índices secundarios para otros tipos de consulta
StockSchema.index({ company: 1 });
StockSchema.index({ quantity: 1 });


module.exports = model('Stock', StockSchema);