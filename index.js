// Libs - Core, standalone utilities
const axiosClient = require('./lib/axiosClient');
const constants = require('thothconst');
const crypt = require('./lib/crypt');
const logger = require('./lib/logger');
const mongoDBService = require('./lib/mongoDBService');
const redisService = require('./lib/redisService');

// Source Modules - Application logic grouped by domain
// This assumes each directory has an index.js file that exports its public members.
const controllers = require('./src/controllers');
const middlewares = require('./src/middlewares');
const models = require('./src/models');
const services = require('./src/services');

try {
  const packageJson = require('./package.json');
  logger.info(`--- EXECUTING VERSION ${packageJson.version} VERSION OF thothlib ---`);
} catch (error) {
  logger.error('Error leyendo package.json:', error.message);
}

module.exports = {
  // Libs
  axiosClient,
  constants,
  crypt,
  logger,
  mongoDBService,
  redisService,

  // Namespaced modules
  controllers,
  middlewares,
  models,
  services,
};
