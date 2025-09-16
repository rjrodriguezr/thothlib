const { Schema, model } = require('mongoose');
const { modelAuditPlugin } = require('../middlewares');
const { movementCategories } = require('thothconst');
const Company = require('./Company'); // Importar el modelo Company
const logger = require('../../lib/logger');

const InventoryAdjustment = Schema({
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: [true, 'Company reference is required'],
    },
    // Número de referencia único para este ajuste
    reference_number: {
        type: String,
        unique: true, // Se generará automáticamente, pero debe ser único
    },
    warehouse: {
        type: Schema.Types.ObjectId,
        ref: 'Warehouse',
        required: [true, 'Warehouse reference is required'],
    },
    // El usuario que realizó el ajuste (Jefe de Almacén)
    user: {
        type: String,
        required: [true, 'Created by is required']
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
    // Array de referencias a los movimientos de inventario generados por este ajuste.
    items: [{
        type: Schema.Types.ObjectId,
        ref: 'Movement',
        required: true
    }],
    notes: {
        type: String,
        trim: true,
    },
    external_reference: {
        type: String,
        trim: true,
    },
}, { toObject: { virtuals: true }, toJSON: { virtuals: true } });
// Especificar que no queremos _id para los elementos del arreglo
InventoryAdjustment.path('items').schema.set('_id', false);

// Middleware Pre-Save para generar el reference_number
InventoryAdjustment.pre('save', async function (next) {
    // 'this' es el documento InventoryAdjustment que se va a guardar.
    // Solo ejecutar esta lógica si el documento es nuevo.
    if (this.isNew) {
        const session = await this.constructor.db.startSession();
        try {
            await session.withTransaction(async () => {
                // 1. Obtener la configuración de la compañía y actualizar el contador atómicamente
                const company = await Company.findOneAndUpdate(
                    { _id: this.company },
                    { $inc: { 'system_settings.sequences.adjustmentStartNumber': 1 } },
                    { new: true, session: session } // 'new: true' devuelve el documento actualizado
                );

                if (!company) {
                    throw new Error(`No se pudo encontrar la compañía con ID ${this.company}`);
                }

                // Asegurar que sequences exista y tenga valores por defecto si es necesario.
                const sequences = company.system_settings.sequences || {};
                const adjustmentPrefix = sequences.adjustmentPrefix || 'ADJ';
                const paddingLength = sequences.paddingLength || 5;

                // El adjustmentStartNumber viene del documento actualizado.
                // Si no existía, $inc lo habrá creado y establecido en 1.
                const adjustmentStartNumber = company.system_settings.sequences.adjustmentStartNumber;

                // El número a usar es el anterior al incremento.
                const currentSequenceNumber = adjustmentStartNumber - 1;

                // 2. Construir el reference_number
                const currentYear = new Date().getFullYear().toString().slice(-2);

                // 'numeracion' es el número de secuencia con ceros a la izquierda
                const numeracion = String(currentSequenceNumber).padStart(paddingLength, '0');

                const generatedRef = `${adjustmentPrefix}-${currentYear}-${numeracion}`;

                this.reference_number = generatedRef;

                logger.info(`Número de referencia generado: ${generatedRef} para la compañía ${this.company}`);
            });
        } catch (error) {
            logger.error(`Error generando el número de referencia para el ajuste de inventario: ${error.message}`);
            // Pasar el error a Mongoose para detener la operación de guardado.
            return next(error);
        } finally {
            // Asegurarse de que la sesión se cierre
            session.endSession();
        }
    }
    // Continuar con la operación de guardado.
    next();
});


// Aplicar plugin de auditoría
InventoryAdjustment.plugin(modelAuditPlugin);

// Índices para búsquedas comunes
InventoryAdjustment.index({ company: 1, warehouse: 1 });
InventoryAdjustment.index({ user: 1 });
InventoryAdjustment.index({ reason: 1 });
InventoryAdjustment.index({ company: 1, reference_number: 1 }, { unique: true });

module.exports = model('InventoryAdjustment', InventoryAdjustment);