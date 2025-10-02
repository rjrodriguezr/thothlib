const { Schema, model } = require('mongoose');
const { modelAuditPlugin } = require('../middlewares');
const { whatsappTemplateCategories, whatsappTemplateStatus } = require("thothconst");

const WapTemplateSchema = new Schema({
    // Referencia a la empresa propietaria de esta plantilla para multi-tenancy
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    // valor referencia que devuelve meta pero no es usado para busquedas
    message_template_id: {
        type: String,
        trim: true,
        unique: true,
    },
    // El nombre de la plantilla, tal como se define en Meta.
    name: {
        type: String,
        required: [true, 'El nombre de la plantilla es obligatorio.'],
        trim: true,
        unique: true,
    },
    // Estado del proceso de revisión de la plantilla.
    status: {
        type: String,
        required: true,
        enum: Object.values(whatsappTemplateStatus),
        default: whatsappTemplateStatus.PENDING,
    },
    // Código de idioma de la plantilla (p. ej., 'en_US', 'es_MX').
    language: {
        type: String,
        required: [true, 'El idioma de la plantilla es obligatorio.'],
        trim: true,
    },
    // Categoría de la plantilla.
    category: {
        type: String,
        required: true,
        enum: Object.values(whatsappTemplateCategories),
    },
    // El contenido de texto del componente HEADER, si existe.
    header: {
        type: String,
        trim: true,
    },
    // El contenido de texto del componente BODY.
    body: {
        type: String,
        required: [true, 'El cuerpo de la plantilla es obligatorio.'],
        trim: true,
    },
    // El contenido de texto del componente FOOTER, si existe.
    footer: {
        type: String,
        trim: true,
    },
});

// Crea un índice compuesto para asegurar que una plantilla sea única para una empresa, nombre e idioma dados.
WapTemplateSchema.index({ company: 1, name: 1, message_template_id: 1 }, { unique: true });

// Aplica el plugin de auditoría para rastrear marcas de tiempo y usuarios de creación/actualización.
WapTemplateSchema.plugin(modelAuditPlugin);

module.exports = model('WapTemplate', WapTemplateSchema, 'wap_templates');