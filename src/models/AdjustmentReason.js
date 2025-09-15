const { Schema, model } = require('mongoose');
const { modelAuditPlugin } = require('../middlewares');
const { movementCategories } = require('thothconst');

const AdjustmentReasonSchema = Schema({
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: [true, 'Company reference is required'],
    },
    name: {
        type: String,
        required: [true, 'Reason name is required'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    // Define si el motivo es para entradas, salidas o ambos (all)
    // Esto evita que se seleccione "Baja por Merma" para una entrada, por ejemplo.
    applies_to: {
        type: String,
        enum: Object.values(movementCategories),
        required: true,
        default: movementCategories.ALL,
    },
    is_active: {
        type: Boolean,
        default: true,
    },
});

// Aplicar plugin de auditoría
AdjustmentReasonSchema.plugin(modelAuditPlugin);

// Índice para asegurar que el nombre del motivo sea único por compañía
AdjustmentReasonSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = model('AdjustmentReason', AdjustmentReasonSchema);