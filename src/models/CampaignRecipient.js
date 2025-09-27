const { Schema, model } = require('mongoose');
const { deliveryType } = require('thothconst');

const CampaignRecipientSchema = new Schema({
    // Vínculo a la campaña padre
    campaign: {
        type: Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true,
        index: true
    },
    // Vínculo a la compañía (desnormalizado para facilitar consultas)
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    // Número de teléfono del destinatario
    numero: {
        type: String,
        required: true,
        trim: true,
    },
    // Estado del envío
    status: {
        type: String,
        // Permitimos que el estado sea null (para campañas en DRAFT)
        // o uno de los valores definidos en deliveryType.
        enum: [...Object.values(deliveryType), null],
        default: null, // Por defecto, un destinatario no tiene estado.
        index: true, // Indexar para búsquedas rápidas por estado (ej: 'scheduled')
    },
    // Parámetros de la plantilla
    params: {
        type: [String],
        default: []
    },
});

// Índice compuesto para asegurar que un número no se repita en la misma campaña
CampaignRecipientSchema.index({ campaign: 1, numero: 1 }, { unique: true });

// No necesitamos el plugin de auditoría aquí, ya que la vida del destinatario
// está ligada a la campaña. Si lo necesitas, puedes añadirlo.
// CampaignRecipientSchema.plugin(modelAuditPlugin);

module.exports = model('CampaignRecipient', CampaignRecipientSchema,"campaign_recipients");