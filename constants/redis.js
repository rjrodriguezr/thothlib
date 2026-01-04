const redisKeyPrefix = Object.freeze({
    COMPANY_SETTINGS: 'company_settings',
    WAP_PHONE_NUMBER_ID: 'wapPhoneNumberId',
    MSN_PAGE_ID: 'msnPageId',
    IGM_BUSINESS_ACCOUNT_ID: 'igmBusinessAccountId',
});

const messagesRedisStream = Object.freeze({
    INCOMING_STREAM_KEY: 'incoming_meta_messages',
    OUTGOING_STREAM_KEY: 'outgoing_meta_messages',
    GROUP_NAME: 'messages_processors_group'
});

const redisChannels = Object.freeze({
    MESSAGE_UPDATE: 'message-updates',
});

module.exports = {
    redisKeyPrefix,
    messagesRedisStream,
    redisChannels,
};
