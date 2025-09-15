const { Schema, model } = require('mongoose');
const { currency, stockStatus } = require('thothconst');
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
    // Unidad de medida del producto
    unit_of_measure: {
        type: Schema.Types.ObjectId,
        ref: 'UnitsOfMeasure',
        required: [true, 'Unit of measure is required']
    },
    // ProductCategory principal obligatorio
    category: {
        type: Schema.Types.ObjectId,
        ref: 'ProductCategory',
        required: [true, 'Product category is required']
    },
    // Tipos de producto adicionales opcionales
    categories: [{
        type: Schema.Types.ObjectId,
        ref: 'ProductCategory'
    }],
    price: {
        base: {
            type: Number,
            required: [true, 'Base price is required'],
            min: [0, 'Price cannot be negative']
        },
        currency: {
            type: String,
            required: true,
            // CURRENCY=> ['DOLAR','EURO''SOL'] => ['USD','EUR''PEN']
            enum: Object.values(currency), 
            default: currency.SOL // 'PEN'
        },
        tax_percentage: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        }
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
    variants: [{
        sku: String,
        price_offset: Number,
        stock: Number,
        attributes: [{
            key: String,
            value: String
        }]
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
});

// Aplicar plugin de auditoría
ProductSchema.plugin(modelAuditPlugin);

ProductSchema.index({ name: 'text', description: 'text' }); // Búsqueda full-text
ProductSchema.index({ company: 1, sku: 1 });
ProductSchema.index({ category: 1 }); // Nuevo índice para búsquedas por categoría principal
ProductSchema.index({ unit_of_measure: 1 }); // Índice para búsquedas por unidad de medida

ProductSchema.virtual('price.total').get(function() {
    return this.price.base * (1 + (this.price.tax_percentage / 100));
});

module.exports = model('Product', ProductSchema);