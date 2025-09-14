const { Schema, model } = require('mongoose');
const { modelAuditPlugin } = require('../middlewares');
const { conversationStatus } = require('thothconst');

const ConversationSchema = new Schema({
    // Vínculo al Chat padre (la relación permanente)
    chat: {
        type: Schema.Types.ObjectId,
        ref: 'Chat',
        required: true,
        index: true
    },
    // Se duplica para facilitar las consultas de facturación por compañía
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    // Estado de la sesión de 24 horas
    status: {
        type: String,
        enum: Object.values(conversationStatus),
        default: conversationStatus.PENDING
    },
    // Timestamps para controlar el ciclo de vida de la sesión
    started_at: { type: Date, default: Date.now },
    expires_at: { type: Date, required: true },
    meta_conversation_id: {
        type: String
    },
    closed_at: { type: Date }
});

ConversationSchema.plugin(modelAuditPlugin);

module.exports = model('Conversation', ConversationSchema);