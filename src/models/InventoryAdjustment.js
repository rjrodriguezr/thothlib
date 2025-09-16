const { Schema, model } = require('mongoose');
const { modelAuditPlugin } = require('../middlewares');
const { movementCategories } = require('thothconst');

const InventoryAdjustment = Schema({
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: [true, 'Company reference is required'],
    },
    // Número de referencia único para este ajuste
    reference_number: {
        type: String,
        required: true,
        unique: true, // Asegura que no haya dos ajustes con la misma referencia
    },
    warehouse: {
        type: Schema.Types.ObjectId,
        ref: 'Warehouse',
        required: [true, 'Warehouse reference is required'],
    },
    // El usuario que realizó el ajuste (Jefe de Almacén)
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User', // Asumo que tienes un modelo 'User'
        required: [true, 'User is required'],
    },
    // Tipo de ajuste
    type: {
        type: String,
        enum: Object.values(movementCategories),
        required: [true, 'Adjustment type is required'],
    },
    reason_label: {
        type: String,
        maxlength: 32,
        required: [true, 'Reason label is required'],
        trim: true
    },
    reason_description: {
        type: String,
        default: '',
        trim: true
    },
    // Array de productos ajustados. Aunque el caso de uso es de uno,
    // diseñarlo así permite ajustes de múltiples productos en el futuro.
    items: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: [0.0001, 'Quantity must be greater than zero'],
        },
        // Se almacena el stock que había ANTES del ajuste para auditoría
        stock_before: {
            type: Number,
            required: true,
        },
        // Y el stock que quedó DESPUÉS
        stock_after: {
            type: Number,
            required: true,
        }
    }],
    notes: {
        type: String,
        trim: true,
    },
    external_reference: {
        type: String,
        trim: true,
    },
});

// Aplicar plugin de auditoría
InventoryAdjustment.plugin(modelAuditPlugin);

// Índices para búsquedas comunes
InventoryAdjustment.index({ company: 1, warehouse: 1 });
InventoryAdjustment.index({ user: 1 });
InventoryAdjustment.index({ reason: 1 });

module.exports = model('InventoryAdjustment', InventoryAdjustment);