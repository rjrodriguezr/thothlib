const { fieldsValidator, validateMongoId } = require('./fieldsValidator');

const buildSaveValidator = (customValidators = []) => [
    ...customValidators,
    fieldsValidator
];

const buildGetValidator = (customValidators = []) => [
    ...customValidators,
    fieldsValidator
];

const buildUpdateValidator = (customValidators = []) => [
    validateMongoId('param', 'id'),
    ...customValidators,
    fieldsValidator
];

const buildDeleteValidator = () => [
    validateMongoId('param', 'id'),
    fieldsValidator
];

module.exports = {
    buildSaveValidator,
    buildGetValidator,
    buildUpdateValidator,
    buildDeleteValidator
};