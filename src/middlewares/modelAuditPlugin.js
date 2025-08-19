const mongoose = require('mongoose');

/**
 * Un plugin de Mongoose que añade campos de auditoría comunes y middleware a un esquema.
 *
 * Los campos añadidos son:
 * - active: {Boolean} - Indica si el documento está activo.
 * - created_at: {Date} - Fecha de creación del documento.
 * - created_by: {String} - Quién creó el documento.
 * - modified_at: {Date} - Fecha de la última modificación del documento.
 * - modified_by: {String} - Quién realizó la última modificación.
 *
 * También añade hooks 'pre' para gestionar automáticamente las fechas de creación y modificación.
 *
 * @param {mongoose.Schema} schema El esquema de Mongoose al que se le aplicará el plugin.
 */
const modelAuditPlugin = (schema) => {
  // Añade los campos comunes de auditoría al esquema.
  schema.add({
    active: {
      type: Boolean,
      default: true
    },
    created_at: {
      type: Date,
      default: Date.now
    },
    created_by: {
      type: String,
      required: [true, 'Created by is required']
    },
    modified_at: {
      type: Date,
      default: Date.now
    },
    modified_by: {
      type: String,
      required: [true, 'Modified by is required']
    }
  });

  /**
   * Middleware que se ejecuta antes de la operación 'save'.
   * Establece las fechas 'created_at' y 'modified_at' al momento de la creación.
   * Si el documento ya tiene 'created_at', solo actualiza 'modified_at'.
   * @param {Function} next - Función callback para pasar al siguiente middleware.
   */
  schema.pre('save', function (next) {
    const now = new Date();
    // Si 'created_at' no existe, asígnalo.
    if (!this.created_at) {
      this.created_at = now;
    }
    // Siempre actualiza 'modified_at' al guardar.
    this.modified_at = now;
    
    next();
  });

  /**
   * Middleware que se ejecuta antes de las operaciones de actualización como 'updateOne' y 'findOneAndUpdate'.
   * Establece el campo 'modified_at' con la fecha y hora actual para reflejar la modificación.
   * @param {Function} next - Función callback para pasar al siguiente middleware.
   */
  schema.pre(['updateOne', 'findOneAndUpdate'], function (next) {
    // 'this' se refiere a la consulta (query), no al documento.
    // Usamos 'this.set()' para añadir la actualización al objeto de consulta.
    this.set({ modified_at: new Date() });
    next();
  });
};

module.exports = modelAuditPlugin;