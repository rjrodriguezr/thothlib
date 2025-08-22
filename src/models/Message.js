const logger = require('../../lib/logger');
const { Schema, model } = require('mongoose');
const redisService = require('../../lib/redisService'); // 1. Importamos el servicio de Redis
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
        required: true,
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
    // Contenido flexible del mensaje
    content: {
        // Contenido del mensaje
        text: {
            type: String,
            trim: true
        },
        // URL para archivos, imágenes, etc.
        url: String,
        caption: String // Pie de foto para imágenes
    },
    // Estado de entrega del mensaje
    status: {
        type: String,
        enum: Object.values(deliveryType),
        default: deliveryType.SENDING,
    }
});

MessageSchema.post('findOneAndUpdate', async function (doc) {
    // 'doc' es el documento DESPUÉS de ser actualizado.
    // IMPORTANTE: Para que 'doc' no sea null, la consulta en tu worker DEBE
    // usar la opción { new: true }. Ejemplo:
    // await Message.findOneAndUpdate({ _id }, update, { new: true });

    if (!doc) {
        logger.warn('Hook findOneAndUpdate ejecutado pero no se encontró el documento. ¿Falta { new: true } en la consulta?');
        return;
    }

    // Verificamos si el campo 'status' fue parte de esta actualización específica.
    const update = this.getUpdate();
    const newStatus = update.$set && update.$set.status;

    if (!newStatus) {
        // El estado no cambió en esta operación, no hay nada que notificar.
        return;
    }

    // Solo publicamos si el cliente de Redis está listo.
    if (!redisService.client || redisService.client.status !== 'ready') {
        logger.error(`Redis no está listo. No se pudo publicar la actualización de estado para el mensaje ${doc._id}`);
        return;
    }

    try {
        const notificationPayload = {
            messageId: doc._id.toString(),
            chatId: doc.chat.toString(),
            newStatus: newStatus,
            metaMessageId: doc.metaMessageId,
            updatedAt: doc.updatedAt // Incluir la fecha de actualización es útil
        };

        // Publicamos el evento en un canal de Pub/Sub.
        // La API 'MESSAGES' estará suscrita a este canal.
        const channel = redisChannels.MESSAGE_UPDATE;
        await redisService.publish(channel, notificationPayload);

        logger.debug(`Evento de estado '${newStatus}' para mensaje ${doc._id} publicado en el canal '${channel}'.`);

    } catch (error) {
        logger.error(`Error en el hook post-findOneAndUpdate para el mensaje ${doc._id}:`, error);
    }
});

MessageSchema.plugin(modelAuditPlugin);

module.exports = model('Message', MessageSchema);