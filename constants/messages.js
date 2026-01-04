const messageTypes = Object.freeze({
    RECEIVED: 'message_received',
    STATUS: 'message_status',
    POSTBACK: 'postback',
    READ: 'message_read',
    DELIVERED: 'message_delivered',
    REACTION: 'message_reaction'
});

const contentType = Object.freeze({
    TEXT: 'text',
    IMAGE: 'image',
    FILE: 'file',
    TEMPLATE: 'template'
});

const deliveryType = Object.freeze({
    SENDING: 'sending',
    SENT: 'sent',
    DELIVERED: 'delivered',
    READ: 'read',
    READ: 'deleted',
    FAILED: 'failed'
});

module.exports = {
    messageTypes,
    contentType,
    deliveryType,
};
