const logger = require('../../lib/logger');
const { Schema, model } = require('mongoose');
const { modelAuditPlugin } = require('../middlewares');
const { encrypt, decrypt, hash } = require('../../lib/crypt'); // Asegúrate que la ruta sea correcta

const CustomerSchema = Schema({
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: [true, 'Company reference is required'],
    },
    name: {
        type: String,
        required: [true, 'name is required'],
        set: encrypt, // Encriptar al guardar
        get: decrypt  // Desencriptar al leer
    },
    last_name: {
        type: String,
        set: encrypt,
        get: decrypt
    },
    doc_type: {
        type: String,
        required: [true, 'document type is required'],
        enum: Object.values(['DNI', 'RUC', 'CE']),
    },
    doc_number: { // Este campo almacenará el valor encriptado
        type: String,
        required: [true, 'document number is required'],
        set: encrypt,
        get: decrypt
    },
    doc_number_hash: { // Para búsquedas y unicidad
        type: String,
        // select: false // Opcional: no devolver por defecto en queries
    },
    email: { // Este campo almacenará el valor encriptado
        type: String,
        default: '',
        set: encrypt,
        get: decrypt
    },
    email_hash: { // Para búsquedas y unicidad
        type: String,
        // select: false // Opcional
    },
    phone: {
        type: String,
        default: '',
        set: encrypt,
        get: decrypt,
    },
    description: {
        type: String,
        default: '',
        set: encrypt,
        get: decrypt,
    },
    //searchText: { type: String }, // Si se usa, considerar cómo afecta la encriptación
}, {
    // Asegúrate de que los getters se apliquen al convertir a objeto/JSON
    toObject: { getters: true, virtuals: true },
    toJSON: { getters: true, virtuals: true }
});

// Middleware Pre-Save para generar hashes
CustomerSchema.pre('save', function (next) {
    // 'this' es el documento
    // Los setters ya habrán encriptado los campos.
    // Para generar el hash, necesitamos acceder al valor original ANTES de que el setter lo modifique.
    // O, si el setter ya actuó, necesitaríamos una forma de obtener el valor original.
    // La forma más simple es hashear el valor que se está asignando.
    // Sin embargo, los setters se ejecutan cuando se asigna el valor.
    // Si el valor se modifica, el getter nos dará el valor desencriptado.

    // Si 'doc_number' se modificó, actualiza 'doc_number_hash'
    if (this.isModified('doc_number') && this.doc_number) { // this.doc_number aquí usa el GETTER        
        this.doc_number_hash = hash(this.doc_number); // Hash del valor desencriptado
    }
    // Si 'email' se modificó, actualiza 'email_hash'
    if (this.isModified('email') && this.email) { // this.email aquí usa el GETTER
        this.email_hash = hash(this.email);
    }

    // Lógica para searchText (si se vuelve a habilitar):
    // Asegúrate de usar los valores desencriptados (los getters lo hacen automáticamente)
    // if (this.isModified('name') || this.isModified('last_name') || this.isModified('doc_number') || this.isModified('email') || this.isModified('phone')) {
    //     this.searchText = `${this.name ?? ''} ${this.last_name ?? ''} ${this.doc_number ?? ''} ${this.email ?? ''} ${this.phone ?? ''}`;
    // }
    next();
});


// --- Hooks para updateOne, findOneAndUpdate ---
// Estos son más complejos porque los setters/getters no se aplican automáticamente a las operaciones de actualización masiva.
// Debes encriptar manualmente los datos en el objeto de actualización y actualizar los hashes.

CustomerSchema.pre(['updateOne', 'findOneAndUpdate'], async function (next) {
    const update = this.getUpdate(); // Obtiene el objeto de actualización

    const fieldsToEncrypt = ['name', 'last_name', 'doc_number', 'email', 'phone', 'description'];

    for (const field of fieldsToEncrypt) {
        if (update.$set && update.$set[field]) {
            const plainValue = update.$set[field];
            update.$set[field] = encrypt(plainValue); // Encriptar
            if (field === 'doc_number') {
                update.$set.doc_number_hash = hash(plainValue); // Actualizar hash
            }
            if (field === 'email') {
                update.$set.email_hash = hash(plainValue); // Actualizar hash
            }
        }
        // Considerar otros operadores como $setOnInsert
        if (update.$setOnInsert && update.$setOnInsert[field]) {
            const plainValue = update.$setOnInsert[field];
            update.$setOnInsert[field] = encrypt(plainValue);
            if (field === 'doc_number') {
                update.$setOnInsert.doc_number_hash = hash(plainValue);
            }
            if (field === 'email') {
                update.$setOnInsert.email_hash = hash(plainValue);
            }
        }
    }
    this.setUpdate(update);
    next();
});


// --- Índices ---
// El índice original 'unique: true' en doc_number se moverá al hash.
// CustomerSchema.index({ company: 1, doc_type: 1, doc_number: 1 }, ... ); // Ya no es único en doc_number encriptado
CustomerSchema.index(
    { company: 1, doc_type: 1, doc_number_hash: 1 }, // Unicidad en el hash
    { unique: true, name: 'unique_doc_hash_per_company' }
);

// CustomerSchema.index({ company: 1, email: 1 }, ...); // Ya no es único en email encriptado
CustomerSchema.index(
    { company: 1, email_hash: 1 }, // Unicidad en el hash
    { unique: true, sparse: true, name: 'unique_email_hash_per_company' } // sparse: true si el email puede ser null/ausente
);

CustomerSchema.index({ company: 1, created_at: 1 });
// CustomerSchema.index({ searchText: 'text' }); // Si usas searchText encriptado, el índice de texto no será efectivo.

CustomerSchema.plugin(modelAuditPlugin);

// --- POST Hooks para la lógica de caché de Redis ---
// Asegúrate que doc.toObject() use getters para pasar datos desencriptados a Redis.
// El { toObject: { getters: true } } en la definición del Schema debería ayudar.
// Si no, explícitamente usa doc.toObject({ getters: true }) en los hooks.

CustomerSchema.post('save', async function (doc, next) {
    const customerDataForRedis = doc.toObject({ getters: true }); // Usa getters
    const companyId = customerDataForRedis.company._id ? customerDataForRedis.company._id.toString() : customerDataForRedis.company.toString();

    if (doc.isNew && customerDataForRedis.active !== false) {
        try {
            const { indexCustomerForAutocomplete } = require("../services");
            await indexCustomerForAutocomplete(customerDataForRedis, companyId);
            logger.debug(`[Redis Hook] Nuevo cliente ${customerDataForRedis._id} (company ${companyId}) indexado.`);
        } catch (error) {
            logger.error(`[Redis Hook] Error al indexar nuevo cliente ${customerDataForRedis._id}:`, error);
        }
    } else {
        const wasModifiedActive = doc.isModified('active'); // 'active' no está encriptado
        const relevantFieldsChanged = ['name', 'last_name', 'doc_number'].some(field => doc.isModified(field));

        if (wasModifiedActive) {
            if (customerDataForRedis.active === false) {
                try {
                    const { removeCustomerFromAutocompleteIndex } = require("../services");
                    await removeCustomerFromAutocompleteIndex(customerDataForRedis._id.toString(), companyId);
                    logger.debug(`[Redis Hook] Cliente ${customerDataForRedis._id} (company ${companyId}) eliminado por active: false.`);
                } catch (error) {
                    logger.error(`[Redis Hook] Error al eliminar cliente ${customerDataForRedis._id} por active: false:`, error);
                }
            } else if (customerDataForRedis.active === true) {
                try {
                    const { indexCustomerForAutocomplete } = require("../services");
                    await indexCustomerForAutocomplete(customerDataForRedis, companyId);
                    logger.debug(`[Redis Hook] Cliente ${customerDataForRedis._id} (company ${companyId}) re-indexado por active: true.`);
                } catch (error) {
                    logger.error(`[Redis Hook] Error al re-indexar cliente ${customerDataForRedis._id} por active: true:`, error);
                }
            }
        }

        if (customerDataForRedis.active !== false && relevantFieldsChanged) {
            try {
                const { updateCustomerAutocompleteIndex } = require("../services");
                await updateCustomerAutocompleteIndex(customerDataForRedis, companyId);
                logger.debug(`[Redis Hook] Cliente ${customerDataForRedis._id} (company ${companyId}) re-indexado por cambio de datos.`);
            } catch (error) {
                logger.error(`[Redis Hook] Error al re-indexar cliente ${customerDataForRedis._id} por cambio de datos:`, error);
            }
        }
    }
    next();
});

CustomerSchema.post(['updateOne', 'findOneAndUpdate'], async function (result, next) {
    // 'this' es la query. 'result' es el resultado de la operación.
    // Si la operación modificó un documento (e.g., result.ok o result.value)
    // y necesitas el documento actualizado para Redis, debes recuperarlo.
    if (!result || (result.value === null)) { // Para findOneAndUpdate, result es el doc o null. Para updateOne, es un objeto de resultado.
        return next();
    }

    // Para findOneAndUpdate, 'result' es el documento (antes o después de la actualización, según new: true/false)
    // Si usaste { new: true }, 'result' es el documento actualizado.
    // Los getters se aplicarán al acceder a los campos de 'result'.
    // Para 'updateOne', 'result' no es el documento. Necesitarías una lectura adicional.
    // Este hook es complejo para Redis si no recuperas el documento actualizado.

    // Simplificación: Asumimos que si necesitas el doc actualizado para Redis tras un updateOne/findOneAndUpdate,
    // lo obtendrás con una query separada o tu lógica de servicio lo maneja.
    // El siguiente ejemplo es más para findOneAndUpdate con { new: true }

    const query = this.getQuery();
    const updatedDoc = await this.model.findOne(query).lean({ getters: true }); // lean y getters para datos planos desencriptados

    if (!updatedDoc) {
        // logger.warn(`[Redis Hook] Documento no encontrado después de actualización para re-indexar.`);
        return next();
    }

    // Convertir IDs de company si es necesario (ObjectId a string)
    const companyId = updatedDoc.company ? updatedDoc.company.toString() : null;
    if (!companyId) {
        logger.warn(`[Redis Hook] Company ID no encontrado en documento actualizado ${updatedDoc._id}`);
        return next();
    }

    // Lógica similar a la del post('save') para determinar si (re)indexar o eliminar de Redis
    const isActiveNow = updatedDoc.active !== false;
    // Para determinar si los campos relevantes cambiaron, necesitarías el estado anterior.
    // Esta parte es compleja y puede requerir obtener el documento original antes de la actualización.
    // Por simplicidad, aquí podríamos re-indexar si está activo.
    if (isActiveNow) {
        try {
            const { updateCustomerAutocompleteIndex } = require("../services");
            await updateCustomerAutocompleteIndex(updatedDoc, companyId);
            logger.debug(`[Redis Hook] Cliente ${updatedDoc._id} (company ${companyId}) potencialmente re-indexado via update.`);
        } catch (error) {
            logger.error(`[Redis Hook] Error al re-indexar cliente ${updatedDoc._id} via update:`, error);
        }
    } else {
        try {
            const { removeCustomerFromAutocompleteIndex } = require("../services");
            await removeCustomerFromAutocompleteIndex(updatedDoc._id.toString(), companyId);
            logger.debug(`[Redis Hook] Cliente ${updatedDoc._id} (company ${companyId}) eliminado por active: false via update.`);
        } catch (error) {
            logger.error(`[Redis Hook] Error al eliminar cliente ${updatedDoc._id} por active: false via update:`, error);
        }
    }

    next();
});

module.exports = model('Customer', CustomerSchema);