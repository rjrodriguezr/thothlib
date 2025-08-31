const { Schema, model } = require('mongoose');
const { modelAuditPlugin } = require('../middlewares');
const { deliveryType, contentType, senderType, redisChannels } = require('../../lib/constants');

const MessageSchema = new Schema({
    // Referencia al chat padre
    chat: {
        type: Schema.Types.ObjectId,
        ref: 'Chat',
        required: true,
        index: true
    },
    // Vínculo directo a la sesión de 24h a la que pertenece
    conversation: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation',
        index: true
    },
    // Referencia a la empresa para facilitar consultas
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    channel: { type: String, required: true },
    // Identificador único del contacto en su plataforma (repetido de chat)
    recipient: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: Object.values(contentType),
        default: contentType.TEXT
    },
    // Campo recomendado para guardar el ID de Meta y poder buscarlo con el webhook
    metaMessageId: {
        type: String,
        index: true
    },
    // Objeto que identifica al remitente del mensaje
    sender: {
        type: {
            type: String,
            required: true,
            enum: Object.values(senderType) // Indica si el remitente es un agente o el contacto externo
        },
        // Si es 'agent', es el ObjectId del usuario. Si es 'contact', es el identifier.
        ref: {
            type: String,
            required: true
        },
        // Nombre del remitente en el momento del envío
        name: {
            type: String,
            required: true
        }
    },
    // Contenido flexible del mensaje, la estructura varía según el campo 'type'.
    // Ej: { text: 'hola' } para 'text', { url: '...', caption: '...' } para 'image', etc.
    content: {
        type: Schema.Types.Mixed,
        required: true,
        default: {}
    },
    // Estado de entrega del mensaje
    status: {
        type: String,
        enum: Object.values(deliveryType),
        default: deliveryType.SENDING,
    }
});

MessageSchema.plugin(modelAuditPlugin);

module.exports = model('Message', MessageSchema);