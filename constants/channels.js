const SUPPORTED_META_CHANNELS = Object.freeze(['whatsapp', 'instagram', 'messenger']);

const channelSource = Object.freeze({
    WHATSAPP: 'whatsapp',
    MESSENGER: 'messenger',
    INSTAGRAM: 'instagram',
    WEBCHAT: 'webchat',
});

module.exports = {
    SUPPORTED_META_CHANNELS,
    channelSource,
};
