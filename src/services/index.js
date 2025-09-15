const { CompanyService, companyService } = require('./CompanyService');
const GlobalService = require('./GlobalService');
const CompanyScopedService = require('./CompanyScopedService');

module.exports = {
    GlobalService,
    CompanyScopedService,
    CompanyService, // La clase
    companyService, // La instancia
};