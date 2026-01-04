const rol = Object.freeze({
    CUSTOMER_ADMIN_ROLE: 'admin', // Rol de administrador del cliente estándar
    SYSTEM_ADMIN_ROLE: 'system', // Rol de administrador del sistema
    USER_ROLE: 'user', // Rol de usuario estandar
    VIEWER_ROLE: 'viewer',
    MESSAGES_AGENT: 'agent',
    MESSAGES_ADMIN: 'messages_admin',
    TRACKING_USER: 'tracking_user',
});

const senderType = Object.freeze({
    AGENT: 'agent',
    CONTACT: 'contact'
});

module.exports = {
    rol,
    senderType,
};
