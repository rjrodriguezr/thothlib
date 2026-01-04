const whatsappTemplateCategories = Object.freeze({
    MARKETING: 'MARKETING',
    UTILITY: 'UTILITY',
    AUTHENTICATION: 'AUTHENTICATION',
});

const whatsappMessageTypes = Object.freeze({
    TEXT: 'text',
    MEDIA: 'media',
    CONTACT: 'contact',
    LOCATION: 'location',
    INTERACTIVE: 'interactive',
    TEMPLATE: 'template',
});

const whatsappTemplateStatus = Object.freeze({
    APPROVED: 'APPROVED',
    IN_APPEAL: 'IN_APPEAL',
    PENDING: 'PENDING',
    REJECTED: 'REJECTED',
    PENDING_DELETION: 'PENDING_DELETION',
    DELETED: 'DELETED',
    DISABLED: 'DISABLED',
    PAUSED: 'PAUSED',
    LIMIT_EXCEEDED: 'LIMIT_EXCEEDED'
});

module.exports = {
    whatsappTemplateCategories,
    whatsappMessageTypes,
    whatsappTemplateStatus,
};
