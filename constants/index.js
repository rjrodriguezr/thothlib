const campaign = require('./campaign');
const channels = require('./channels');
const conversation = require('./conversation');
const http = require('./http');
const inventory = require('./inventory');
const messages = require('./messages');
const redis = require('./redis');
const users = require('./users');
const whatsapp = require('./whatsapp');

module.exports = {
    ...campaign,
    ...channels,
    ...conversation,
    ...http,
    ...inventory,
    ...messages,
    ...redis,
    ...users,
    ...whatsapp,
};