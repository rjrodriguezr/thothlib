const { Schema, model } = require('mongoose');
const { campaignStatuses, deliveryType } = require('thothconst');
const logger = require('../../lib/logger');
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
        validate: {
            validator: function(v) {
                // La validación solo se aplica si el campo 'scheduled_at' está presente.
                if (!v) return true;
                return v > new Date();
            },
            message: 'La fecha de programación debe ser en el futuro.'
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
        scheduled: { type: Number, default: 0 },
        sent: { type: Number, default: 0 },
        delivered: { type: Number, default: 0 }, // Añadido para mayor granularidad
        read: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
        deleted: { type: Number, default: 0 },
    }
}, {    
    minimize: false,
});

/**
 * Hook Pre-Save para inicializar las estadísticas al crear una nueva campaña.
 */
CampaignSchema.pre('save', function(next) {
    // 1. Lógica de bloqueo de campos si la campaña ya no está en borrador o programada.
    // No se aplica a documentos nuevos.
    if (!this.isNew) {
        // Obtenemos el estado original del documento antes de la modificación.
        const originalStatus = this.get('status', null, { getters: false });
        const isLocked = ![campaignStatuses.DRAFT, campaignStatuses.SCHEDULED].includes(originalStatus);

        // Si la campaña está bloqueada, solo permitimos que se modifique el 'status'.
        // Cualquier otro cambio (como 'name', 'template' o 'recipients') lanzará un error.
        const otherFieldsModified = ['name', 'template', 'scheduled_at'].some(field => this.isModified(field));

        if (isLocked && otherFieldsModified) {
            const err = new Error('No se pueden modificar los detalles de una campaña (nombre, plantilla, destinatarios) una vez que ha iniciado su procesamiento.');
            return next(err);
        }
    }
    next();
});

/**
 * Método estático para actualizar el estado de un destinatario y ajustar
 * los contadores de estadísticas de forma atómica.
 *
 * @param {string} campaignId - El ID de la campaña.
 * @param {string} recipientNumero - El número de teléfono del destinatario a actualizar.
 * @param {string} newStatus - El nuevo estado para el destinatario (debe ser un valor de `deliveryType`).
 * @returns {Promise<object|null>} El documento de la campaña actualizado o null si no se encuentra.
 *
 * @note No se requiere una transacción explícita (`session`) aquí. Las operaciones
 * de Mongoose como `findOneAndUpdate` son atómicas a nivel de un solo documento.
 * Dado que todas las actualizaciones (el estado del destinatario y los contadores de `stats`)
 * ocurren dentro del mismo documento `Campaign`, la atomicidad está garantizada.
 */
CampaignSchema.statics.updateRecipientStatus = async function(campaignId, recipientNumero, newStatus) {
    const CampaignRecipient = this.model('CampaignRecipient');

    // 1. Actualizar el documento del destinatario y obtener su estado anterior.
    const recipient = await CampaignRecipient.findOneAndUpdate(
        { campaign: campaignId, numero: recipientNumero },
        { $set: { status: newStatus } },
        { new: false } // Devuelve el documento ANTES de la actualización para obtener oldStatus
    );

    if (!recipient) {
        logger.warn(`No se encontró el destinatario ${recipientNumero} para la campaña ${campaignId}.`);
        return null;
    }

    const oldStatus = recipient.status;

    // Si el estado no ha cambiado, no hacer nada.
    if (oldStatus === newStatus) {
        logger.trace(`El estado para ${recipientNumero} en la campaña ${campaignId} ya es '${newStatus}'. No se requiere actualización.`);
        return this.findById(campaignId); // Devolver la campaña actual
    }

    // 2. Construir la operación de actualización atómica para los contadores de la campaña.
    const updateOperation = {
        $inc: {}
    };
    if (oldStatus) updateOperation.$inc[`stats.${oldStatus}`] = -1;
    if (newStatus) updateOperation.$inc[`stats.${newStatus}`] = 1;

    // 3. Ejecutar la actualización atómica en el documento Campaign.
    return this.findOneAndUpdate(
        { _id: campaignId },
        updateOperation,
        { new: true } // Devuelve el documento actualizado.
    );
};

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