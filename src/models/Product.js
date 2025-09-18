const { Schema, model } = require('mongoose');
const { currency } = require('thothconst');
const { modelAuditPlugin } = require('../middlewares');

const ProductSchema = Schema({
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: [true, 'Company reference is required'],
    },
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    sku: {
        type: String,
        required: [true, 'SKU is required'],
        unique: true,
        uppercase: true,
        match: [/^[A-Z0-9\-_]+$/, 'Invalid SKU format']
    },
    // UOM Category
    uom_category: {
        type: String,
        maxlength: 3,
        required: [true, 'UOM category is required']
    },
    // UOM
    uom: {
        type: String,
        maxlength: 3,
        required: [true, 'UOM is required']
    },
    // Tipos de producto adicionales opcionales
    categories: [{
        type: String,
        maxlength: 3
    }],
    currency: {
        type: String,
        required: true,
        // CURRENCY=> ['DOLAR','EURO''SOL'] => ['USD','EUR''PEN']
        enum: Object.values(currency),
        default: currency.SOL // 'PEN'
    },
    price: {
        type: Number,
        required: [true, 'Base price is required'],
        min: [0, 'Price cannot be negative']
    },
    tax_percentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    attributes: [{
        key: {
            type: String,
            required: true,
            lowercase: true
        },
        value: Schema.Types.Mixed,
        display_text: String
    }],
    tags: [{
        type: String,
        lowercase: true
    }],
    // media: {
    //     images: [{
    //         url: String,
    //         is_primary: Boolean,
    //         description: String
    //     }],
    //     videos: [{
    //         url: String,
    //         thumbnail: String
    //     }]
    // },
    // supplier: {
    //     type: Schema.Types.ObjectId,
    //     ref: 'Supplier'
    // },    
    related_products: [{
        type: Schema.Types.ObjectId,
        ref: 'Product'
    }],
    metadata: Schema.Types.Mixed,
}, { toObject: { virtuals: true }, toJSON: { virtuals: true } });

// Aplicar plugin de auditoría
ProductSchema.plugin(modelAuditPlugin);

ProductSchema.index({ name: 'text', description: 'text', sku: 'text' }); // Búsqueda full-text
ProductSchema.index({ company: 1, sku: 1 });
ProductSchema.index({ category: 1 }); // Nuevo índice para búsquedas por categoría principal
ProductSchema.index({ uom: 1 }); // Índice para búsquedas por unidad de medida

ProductSchema.virtual('price_total').get(function () {
    return this.price * (1 + (this.tax_percentage / 100));
});

module.exports = model('Product', ProductSchema);