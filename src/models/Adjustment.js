const { Schema, model } = require('mongoose');
const { modelAuditPlugin } = require('../middlewares');
const { adjustmentReasons } = require('thothconst');
const Company = require('./Company'); // Importar el modelo Company
const logger = require('../../lib/logger');

const Adjustment = Schema({
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
    reason: {
        type: String,
        enum: Object.values(adjustmentReasons),
        required: [true, 'Adjustment reason is required'],
    },
    reason_description: {
        type: String,
        default: '',
        trim: true
    },
    // Array de referencias a los movimientos de inventario generados por este ajuste.
    items: [{
        type: Schema.Types.ObjectId,
        ref: 'Movement'
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

// Middleware Pre-Save para generar el reference_number
Adjustment.pre('save', async function (next) {
    // 'this' es el documento Adjustment que se va a guardar.
    // Solo ejecutar esta lógica si el documento es nuevo y no tiene un número de referencia.
    if (this.isNew && !this.reference_number) { // Solo si es nuevo y no tiene ya un número
        // El servicio que llama a .save() DEBE proporcionar una sesión.
        // Si no hay sesión, la operación fallará, lo cual es el comportamiento esperado.
        const existingSession = this.$session();
        if (!existingSession) {
            return next(new Error('Se requiere una sesión de transacción para crear un ajuste.'));
        }

        try {
            // 1. Obtener la configuración de la compañía y actualizar el contador atómicamente
            // La operación se une a la transacción existente proporcionada por el servicio.
            const company = await Company.findOneAndUpdate(
                { _id: this.company },
                { 
                    $inc: { 'system_settings.sequences.adjustmentStartNumber': 1 },
                    $set: { modified_by: this.modified_by } // Actualiza quién modificó la compañía
                },
                { new: true, session: existingSession } // 'new: true' devuelve el documento actualizado
            );

            if (!company) {
                throw new Error(`No se pudo encontrar la compañía con ID ${this.company}`);
            }

            // Asegurar que sequences exista y tenga valores por defecto si es necesario.
            const sequences = company.system_settings.sequences || {};
            const adjustmentPrefix = sequences.adjustmentPrefix || 'ADJ';
            const paddingLength = sequences.paddingLength || 5;

            // El adjustmentStartNumber viene del documento actualizado.
            const adjustmentStartNumber = company.system_settings.sequences.adjustmentStartNumber;

            // El número a usar es el anterior al incremento.
            const currentSequenceNumber = adjustmentStartNumber - 1;

            // 2. Construir el reference_number
            const currentYear = new Date().getFullYear().toString().slice(-2);
            const numeracion = String(currentSequenceNumber).padStart(paddingLength, '0');
            const generatedRef = `${adjustmentPrefix}-${currentYear}-${numeracion}`;

            this.reference_number = generatedRef;
            logger.info(`Número de referencia generado: ${generatedRef} para la compañía ${this.company}`);
        } catch (error) {
            logger.error(`Error generando el número de referencia para el ajuste de inventario: ${error.message}`);
            // Pasar el error a Mongoose para detener la operación de guardado.
            return next(error);
        }
    }
    // Continuar con la operación de guardado.
    next();
});


// Aplicar plugin de auditoría
Adjustment.plugin(modelAuditPlugin);

// Índices para búsquedas comunes
Adjustment.index({ company: 1, warehouse: 1 });
Adjustment.index({ reason: 1 });
Adjustment.index({ company: 1, reference_number: 1 }, { unique: true });

module.exports = model('Adjustment', Adjustment);