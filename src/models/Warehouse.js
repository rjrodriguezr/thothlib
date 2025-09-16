const { Schema, model } = require('mongoose');
const { modelAuditPlugin } = require('../middlewares');

const WarehouseSchema = Schema({
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: [true, 'Company reference is required'],
    },
    name: {
        type: String,
        required: [true, 'Warehouse name is required'],
        trim: true,
    },
    address:{
        type: String,
        trim: true,
    },
    city: {
        type: String,
        maxlength: 32,
        trim: true,
    },
    country: {
        type: String,
        maxlength: 64,
        trim: true,
    },    
    metadata: Schema.Types.Mixed,
});

// Aplicar plugin de auditoría
WarehouseSchema.plugin(modelAuditPlugin);

// Índice para asegurar que el nombre del almacén sea único por compañía
WarehouseSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = model('Warehouse', WarehouseSchema);