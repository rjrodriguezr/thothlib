const { Schema, model } = require('mongoose');
const { channelSource } = require('thothconst');
const { modelAuditPlugin } = require('../middlewares');

const ChatSchema = new Schema({
    // Referencia a la empresa para sistemas multi-tenant
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    // El agente (usuario del sistema) asignado al chat
    agent: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null // Puede iniciar sin agente y ser asignado después
    },
    // Datos del contacto externo (cliente)
    contact: {
        channel: {
            type: String,
            required: true,
            enum: Object.values(channelSource),
            trim: true
        },
        // Identificador único del contacto en su plataforma (ej: número de teléfono, ID de usuario de FB)
        identifier: {
            type: String,
            required: true,
            trim: true
        },
        // Nombre para mostrar en la interfaz
        displayName: {
            type: String,
            required: true,
            trim: true
        },
        avatarUrl: {
            type: String,
            default: ''
        }
    },
    // Denormalización del último mensaje para previsualización en la UI
    lastMessage: {
        content: String,
        senderType: String, // 'agent' o 'contact'
        timestamp: Date
    },
    // Referencia a la conversación activa para este chat. Facilita la lógica de negocio.
    activeConversationId: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation',
        default: null
    },
});

ChatSchema.pre('save', function(next) {
    // 'this' se refiere al documento que se va a guardar
    if (this.isNew && !this.contact.avatarUrl) { // Solo si es nuevo y no tiene avatar
        if (this.contact.channel === channelSource.WEBCHAT) {
            // Para WebChat, usar avatares 'web-*' del 1 al 8
            const randomNumber = Math.floor(Math.random() * 8) + 1;
            this.contact.avatarUrl = `web-${randomNumber}.png`;
        } else {
            // Para todos los demás canales, usar avatares 'avatar-*' del 1 al 38
            const randomNumber = Math.floor(Math.random() * 38) + 1;
            this.contact.avatarUrl = `avatar-${randomNumber}.png`;
        }
    }
    next();
});

ChatSchema.plugin(modelAuditPlugin);
// Índice compuesto para buscar rápidamente un chat de un contacto específico en una empresa
ChatSchema.index({ company: 1, 'contact.identifier': 1 });

module.exports = model('Chat', ChatSchema);