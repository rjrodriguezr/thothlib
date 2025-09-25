const { Schema, model } = require('mongoose');
const { campaignStatuses } = require('thothconst');
const { modelAuditPlugin } = require('../middlewares');

const CampaignSchema = new Schema({
    /**
     * Referencia a la empresa propietaria de esta campaña para multi-tenancy.
     */
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    /**
     * Nombre o identificador interno de la campaña.
     */
    name: {
        type: String,
        required: [true, 'El nombre de la campaña es obligatorio.'],
        trim: true,
    },
    /**
     * Para permitir futuras extensiones de campañas
     */
    type: {
        type: String,
        required: [true, 'El tipo de campaña es obligatorio.'],
        default: 'whatsapp'
    },

    /**
     * Referencia al template de WAP que será utilizado, la clave de los templates para wap es el nombre.
     */
    template: {
        type: String,
        required: [true, 'Se requiere una plantilla para la campaña.'],
    },

    /**
     * Estado del ciclo de vida de la campaña. Es el campo principal
     * para los workers que procesan los envíos.
     */
    status: {
        type: String,
        enum: Object.values(campaignStatuses),
        default: campaignStatuses.DRAFT,
    },

    /**
     * Fecha y hora programada para iniciar el envío.
     */
    scheduled_at: {
        type: Date,
        required: true,
        validate: {
            validator: (v) => v > new Date(),
            message: 'La fecha de inicio debe ser en el futuro.'
        }
    },

    /**
     * Timestamps para el seguimiento del procesamiento.
     */
    started_at: { type: Date },
    completed_at: { type: Date },

    /**
     * Objeto desnormalizado para estadísticas agregadas. Estos contadores
     * se actualizan a través de la lógica de la aplicación a medida que
     * los documentos en la colección 'Messages' cambian de estado.
     */
    stats: {
        total: { type: Number, default: 0 },
        sent: { type: Number, default: 0 },
        delivered: { type: Number, default: 0 }, // Añadido para mayor granularidad
        read: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
    }
}, {    
    minimize: false,
});

/**
 * **ÍNDICES PARA OPTIMIZAR CONSULTAS (PERFORMANCE)**
 * Un índice en status y scheduled_at es crucial para que un worker
 * encuentre eficientemente las campañas que debe procesar.
 */
CampaignSchema.index({ company: 1, status: 1, scheduled_at: 1 });
// Índice para buscar campañas por plantilla dentro de una compañía.
CampaignSchema.index({ company: 1, template: 1 });

// Aplica el plugin de auditoría para rastrear marcas de tiempo y usuarios de creación/actualización.
CampaignSchema.plugin(modelAuditPlugin);

module.exports = model('Campaign', CampaignSchema);