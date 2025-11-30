const mongoose = require('mongoose');

/**
 * Un plugin de Mongoose que añade campos de auditoría comunes y middleware a un esquema.
 *
 * Los campos añadidos son:
 * - isActive: {Boolean} - Indica si el documento está activo.
 * - createdAt: {Date} - Fecha de creación del documento.
 * - createdBy: {String} - Quién creó el documento.
 * - updatedAt: {Date} - Fecha de la última modificación del documento.
 * - updatedBy: {String} - Quién realizó la última modificación.
 *
 * También añade hooks 'pre' para gestionar automáticamente las fechas de creación y modificación.
 *
 * @param {mongoose.Schema} schema El esquema de Mongoose al que se le aplicará el plugin.
 */
const modelAuditPlugin = (schema) => {
  // Añade los campos comunes de auditoría al esquema.
  schema.add({
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: String,
      required: [true, 'Created by is required']
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: String,
      required: [true, 'Modified by is required']
    }
  });

  /**
   * Middleware que se ejecuta antes de la operación 'save'.
   * Establece las fechas 'createdAt' y 'updatedAt' al momento de la creación.
   * Si el documento ya tiene 'createdAt', solo actualiza 'updatedAt'.
   * @param {Function} next - Función callback para pasar al siguiente middleware.
   */
  schema.pre('save', function (next) {
    const now = new Date();
    // Si 'createdAt' no existe, asígnalo.
    if (!this.createdAt) {
      this.createdAt = now;
    }
    // Siempre actualiza 'updatedAt' al guardar.
    this.updatedAt = now;
    
    next();
  });

  /**
   * Middleware que se ejecuta antes de las operaciones de actualización como 'updateOne' y 'findOneAndUpdate'.
   * Establece el campo 'updatedAt' con la fecha y hora actual para reflejar la modificación.
   * @param {Function} next - Función callback para pasar al siguiente middleware.
   */
  schema.pre(['updateOne', 'findOneAndUpdate'], function (next) {
    // 'this' se refiere a la consulta (query), no al documento.
    // Usamos 'this.set()' para añadir la actualización al objeto de consulta.
    this.set({ updatedAt: new Date() });
    next();
  });
};

module.exports = modelAuditPlugin;