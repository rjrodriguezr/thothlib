const mongoose = require('mongoose');
const { modelAuditPlugin } = require('../middlewares');

const AttributeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, required: true, enum: ['string', 'number', 'boolean', 'date'] },
    required: { type: Boolean, default: false },
    unit: { type: String }
}, { _id: false });

const ProductCategorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String },
    attributes: [AttributeSchema],
    parent_category: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductCategory', default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
});

// Aplicar plugin de auditoría
ProductCategorySchema.plugin(modelAuditPlugin);

// Índices
ProductCategorySchema.index({ parent_category: 1 });

module.exports = mongoose.model('ProductCategory', ProductCategorySchema, "product_categories");
