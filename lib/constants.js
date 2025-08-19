const SUPPORTED_META_CHANNELS = Object.freeze(['whatsapp', 'instagram', 'messenger']);
const WEBHOOK_SOURCE_TYPE = "webhook";

const redisKeyPrefix = Object.freeze({
    COMPANY_SETTINGS: 'company_settings',
    WAP_PHONE_NUMBER_ID: 'wapPhoneNumberId',
    MSN_PAGE_ID: 'msnPageId',
    IGM_BUSINESS_ACCOUNT_ID: 'igmBusinessAccountId',
});

const rol = Object.freeze({
    CUSTOMER_ADMIN_ROLE: 'admin', // Rol de administrador del cliente estándar
    SYSTEM_ADMIN_ROLE: 'system', // Rol de administrador del sistema
    USER_ROLE: 'user', // Rol de usuario estandar
    VIEWER_ROLE: 'viewer',
    MESSAGES_AGENT: 'agent',
    MESSAGES_ADMIN: 'messages_admin',
    TRACKING_USER: 'tracking_user',
});

const metaChannels = Object.freeze({
    WHATSAPP: 'whatsapp',
    MESSENGER: 'messenger',
    INSTAGRAM: 'instagram',
});

const chatSources = Object.freeze({
    WHATSAPP: 'wap',
    MESSENGER: 'msn',
    INSTAGRAM: 'igm',
    WEBCHAT: 'web',
});

const headers = Object.freeze({
    COMPANY_ID: 'X-Company-Id',
    COMPANY_NAME: 'X-Company-Name',
    CONTENT_TYPE: 'Content-Type',
    INTERNAL_REQUEST: 'X-Internal-Request',
    SERVICE_CHANNEL: 'X-Service-Channel',
    SOURCE_TYPE: 'X-Source-Type',
    USER_AGENT: 'User-Agent',
    USER_ID: 'X-User-Id',
    USER_NAME: 'X-User-Name',
    USER_ROLES: 'X-User-Roles',
    CONSUMER_USERNAME: 'X-Consumer-Username'
});

const messagesRedisStream = Object.freeze({
    INCOMING_STREAM_KEY: 'incoming_meta_messages',
    OUTGOING_STREAM_KEY: 'outgoing_meta_messages',
    GROUP_NAME: 'messages_processors_group'
});

const redisChannels = Object.freeze({
    MESSAGE_UPDATE: 'message-updates',
});

const whatsappTemplateCategories = Object.freeze({
    MARKETING: 'marketing',
    UTILITY: 'utility',
    AUTHTENTICATION: 'authentication',
});

const whatsappMessageTypes = Object.freeze({
    TEXT: 'text',
    MEDIA: 'media',
    CONTACT: 'contact',
    LOCATION: 'location',
    INTERACTIVE: 'interactive',
    TEMPLATE: 'template',
});

const conversationStatus = Object.freeze({
    OPEN: 'open',
    CLOSED: 'closed'
});

const senderType = Object.freeze({
    AGENT: 'agent',
    CONTACT: 'contact'
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
    FAILED: 'failed'
});

module.exports = {
    chatSources,
    headers,
    metaChannels,
    redisKeyPrefix,
    rol,
    messagesRedisStream,
    whatsappTemplateCategories,
    whatsappMessageTypes,
    WEBHOOK_SOURCE_TYPE,
    SUPPORTED_META_CHANNELS,
    conversationStatus,
    senderType,
    contentType,
    deliveryType,
    redisChannels
}