const { Schema, model } = require('mongoose');
const { modelAuditPlugin } = require('../middlewares');
const { movementTypes } = require('thothconst');
const Stock = require('./Stock'); // Importar el modelo Stock

const MovementSchema = Schema({
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    warehouse: {
        type: Schema.Types.ObjectId,
        ref: 'Warehouse',
        required: true,
    },
    product: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },

    // --- INICIO DE LA CORRECCIÓN ARQUITECTÓNICA ---

    // ID del documento que origina el movimiento (polimórfico)
    source_document_id: {
        type: Schema.Types.ObjectId,
        required: true,
    },
    // Nombre del Modelo del documento de origen (ej: 'InventoryAdjustment', 'SaleOrder')
    source_document_type: {
        type: String,
        required: true,
    },
    // El tipo de movimiento ahora es más descriptivo y no se limita a ajustes
    type: {
        type: String,
        enum: Object.values(movementTypes),
        required: true,
    },

    // --- FIN DE LA CORRECCIÓN ARQUITECTÓNICA ---

    quantity_change: {
        type: Number,
        required: true,
    },
    stock_before: {
        type: Number,
        // required: true, // Se elimina 'required' porque el pre-save hook se encarga de asignarlo.
    },
    stock_after: {
        type: Number,
        // required: true, // Se elimina 'required' porque el pre-save hook se encarga de asignarlo.
    },
});

// Middleware Pre-Save para actualizar el stock atómicamente
MovementSchema.pre('save', async function (next) {
    // 'this' es el documento Movement que se va a guardar.
    // Solo ejecutar esta lógica si el documento es nuevo.
    if (!this.isNew) {
        return next();
    }

    // El servicio que llama a .save() DEBE proporcionar una sesión.
    // Si no hay sesión, la operación fallará, lo cual es el comportamiento esperado.
    const existingSession = this.$session();
    if (!existingSession) {
        return next(new Error('Se requiere una sesión de transacción para crear un movimiento.'));
    }

    try {
        const { company, warehouse, product, type, quantity_change } = this;

        // Asignar campos de auditoría. Asumimos que el creador del movimiento
        // se pasa en el cuerpo del documento al crearlo.
        // Si `created_by` no existe, se asigna.
        if (!this.created_by) this.created_by = this.modified_by;
        // `modified_by` siempre se actualiza.

        // 1. Definir el filtro base para encontrar el stock
        const stockFilter = { company, warehouse, product };

        // 2. Obtener el stock ANTES de la modificación para registrar 'stock_before'
        // Usamos findOne y no findOneAndUpdate aquí para obtener el estado inicial.
        const stockBeforeUpdate = await Stock.findOne(stockFilter).session(existingSession);

        // Si no hay stock, el valor inicial es 0. Si existe, tomamos su cantidad.
        this.stock_before = stockBeforeUpdate ? stockBeforeUpdate.quantity : 0;

        let updatedStock;

        // 3. Lógica de actualización dependiendo del tipo de movimiento
        if (type === movementTypes.INBOUND) {
            // Para entradas, simplemente incrementamos la cantidad.
            // `upsert: true` crea el documento de stock si no existe.
            // Al usar `upsert`, debemos proporcionar los campos de auditoría para el caso de creación.
            updatedStock = await Stock.findOneAndUpdate(
                stockFilter,
                { 
                    $inc: { quantity: quantity_change },
                    $set: { modified_by: this.modified_by }, // Siempre actualiza quién modificó
                    $setOnInsert: { created_by: this.modified_by } // Asigna quién creó solo si se inserta
                },
                { new: true, upsert: true, session: existingSession, setDefaultsOnInsert: true }
            );
        } else if (type === movementTypes.OUTBOUND) {
            // Para salidas, la lógica es más compleja para evitar stock negativo.
            // Añadimos al filtro que la cantidad actual debe ser suficiente.
            const outboundFilter = { ...stockFilter, quantity: { $gte: quantity_change } };

            updatedStock = await Stock.findOneAndUpdate(
                outboundFilter,
                { 
                    $inc: { quantity: -quantity_change }, // Restamos la cantidad
                    $set: { modified_by: this.modified_by } // Actualiza quién modificó
                },
                { new: true, session: existingSession } // `upsert` no es necesario aquí, si no hay stock, no se puede sacar.
            );

            // Si `updatedStock` es null, significa que la condición `quantity >= quantity_change` no se cumplió.
            if (!updatedStock) {
                throw new Error(`No se puede retirar del almacén. Stock insuficiente para el producto ${product}.`);
            }
        }
        // 4. Registrar el 'stock_after' en el movimiento
        this.stock_after = updatedStock.quantity;
    } catch (error) {
        return next(error); // Pasar el error a Mongoose para detener la operación.
    }

    next();
});

MovementSchema.plugin(modelAuditPlugin);
// Creamos un índice sobre los campos polimórficos para poder buscar
// todos los movimientos originados por un documento específico.
MovementSchema.index({ source_document_id: 1, source_document_type: 1 });

// El índice principal para consultar el historial de un producto no cambia.
MovementSchema.index({ product: 1, warehouse: 1, created_at: -1 });


module.exports = model('Movement', MovementSchema);