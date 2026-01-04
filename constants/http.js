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

const WEBHOOK_SOURCE_TYPE = "webhook";

module.exports = {
    headers,
    WEBHOOK_SOURCE_TYPE,
};
