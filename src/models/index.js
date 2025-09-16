const fs = require('fs');
const path = require('path');

const models = {};
const basename = path.basename(__filename);

fs
  .readdirSync(__dirname)
  .filter(file => {
    // Retornar solo archivos .js que no sean el index.js actual
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js'
    );
  })
  .forEach(file => {
    // Importar el modelo
    const model = require(path.join(__dirname, file));
    // Obtener el nombre del modelo (generalmente el nombre del archivo sin .js)
    const modelName = path.basename(file, '.js');
    // Asignarlo al objeto de modelos
    models[modelName] = model;
  });

module.exports = models;