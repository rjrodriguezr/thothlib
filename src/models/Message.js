const { Schema, model } = require('mongoose');
const { modelAuditPlugin } = require('../middlewares');
const Chat = require('./Chat'); // Importar el modelo Chat
const { deliveryType, contentType, senderType, channelSource } = require('thothconst');

const MessageSchema = new Schema({
    // Referencia al chat padre
    chat: {
        type: Schema.Types.ObjectId,
        ref: 'Chat',
        // required: true, // Se quita 'required' para que el pre-save hook pueda asignarlo.
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
    // Referencia a la empresa para facilitar consultas
    campaign: {
        type: Schema.Types.ObjectId,
        ref: 'Campaign'
    },    
    channel: { 
        type: String, 
        required: true,
        enum: Object.values(channelSource),
    },
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

/**
 * Middleware Pre-Save para asegurar la existencia de un Chat.
 * Si un mensaje llega sin una referencia a un Chat, este hook
 * buscará uno existente o creará uno nuevo y lo asignará.
 */
MessageSchema.pre('save', async function (next) {
    // 'this' es el documento Message que se va a guardar.
    // Solo ejecutar esta lógica si el documento es nuevo y no tiene un chat asignado.
    if (this.isNew && !this.chat) {
        try {
            // Buscar un chat existente para este contacto en esta compañía.
            let chat = await Chat.findOne({
                company: this.company,
                'contact.identifier': this.recipient
            });

            // Si no se encuentra un chat, crear uno nuevo.
            if (!chat) {
                chat = new Chat({
                    company: this.company,
                    contact: {
                        channel: this.channel,
                        identifier: this.recipient,
                        displayName: this.sender.name, // Usar el nombre del remitente como displayName inicial
                    },
                    // Denormalizar el primer mensaje como el 'lastMessage' del nuevo chat
                    lastMessage: {
                        content: this.content.text, // Asume que el contenido es de tipo texto
                        senderType: this.sender.type,
                        timestamp: new Date()
                    }
                });
                await chat.save();
            }
            // Asignar el ID del chat (existente o nuevo) al mensaje.
            this.chat = chat._id;
        } catch (error) {
            // Si hay un error, pasarlo al siguiente middleware para que Mongoose lo maneje.
            return next(error);
        }
    }
    // Continuar con la operación de guardado.
    next();
});

MessageSchema.plugin(modelAuditPlugin);

module.exports = model('Message', MessageSchema);