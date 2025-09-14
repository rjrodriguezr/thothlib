const { Schema, model } = require('mongoose');
const { unitMeasureCategories } = require('thothconst');
const { modelAuditPlugin } = require('../middlewares');

const UnitsOfMeasureSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true, // No puede haber dos unidades con el mismo nombre
    trim: true,
  },
  code: {
    type: String,
    required: true,
    unique: true, // Código único (ej.: "UNIDAD", "PAQUETE", "CAJA")
    uppercase: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    enum: Object.values(unitMeasureCategories),
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  conversionFactor: {
    type: Number,
    default: 1,
    // Factor para convertir a unidad base si aplica (ej.: 1 caja = 24 unidades)
  },
  baseUnit: {
    type: String,
    default: null,
    // Código de la unidad base a la que esta se puede convertir, si es compuesta (ej.: CAJA -> UNIDAD)
  }
});

// Aplicar plugin de auditoría
UnitsOfMeasureSchema.plugin(modelAuditPlugin);

UnitsOfMeasureSchema.index({ category: 1 });
UnitsOfMeasureSchema.index({ baseUnit: 1 });

module.exports = model('UnitsOfMeasure', UnitsOfMeasureSchema, "units_of_measure");