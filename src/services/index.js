const BaseService = require('./BaseService');
const CompanyService = require('./companyService');
const logger = require('../../lib/logger');
const redisService = require('../../lib/redisService');
const constants = require('../../lib/constants');
const { Company } = require('../models');

// Se crea una única instancia del servicio con sus dependencias.
const companyService = new CompanyService({
    logger,
    redisService,
    constants,
    Company
});

module.exports = {
    BaseService,
    companyService
};