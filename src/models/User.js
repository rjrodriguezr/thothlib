const { Schema, model } = require('mongoose');
const { modelAuditPlugin } = require('../middlewares');
const { rol } = require("../../lib/constants");
const bcrypt = require('bcrypt');
const logger = require('../../lib/logger');

const UserSchema = new Schema({
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: function () {
            // Campo requerido solo si el usuario NO es admin global
            return !this.roles.includes(rol.SYSTEM_ADMIN_ROLE);
        }
    },
    // TODO ENCRIPTAR EL EMAIL
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email format']
    },
    username: {
        type: String,
        trim: true,
        lowercase: true,
        default: '' // Se generará automáticamente
    },
    password: {
        type: String,
        required: function () { return this.provider === 'local'; },
        select: false // No se devuelve en queries por defecto
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    last_name: {
        type: String,
        trim: true,
        default: ''
    },
    roles: {
        type: [String],
        enum: Object.values(rol),
        default: [rol.USER_ROLE],
        required: true
    },
    permissions: {
        type: Schema.Types.Mixed, // Ej: { products: ['read', 'write'], customers: ['read'] }
        default: {}
    },
    profile: {
        avatar: {
            type: String,
            default: ''
        },
        bio: {
            type: String,
            maxlength: 200,
            default: ''
        },
        gender: {
            type: String,
            enum: Object.values(['M', 'F']),
            default: 'M'
        },
        language: {
            type: String,
            enum: Object.values(['es', 'en', 'pt']),
            default: 'es'
        }
    },
    provider: {
        type: String,
        enum: Object.values(['local', 'google', 'facebook']),
        default: 'local'
    },
    provider_id: { // ID de proveedor externo (ej: Google ID)
        type: String,
        default: null
    },
    email_verified: {
        type: Boolean,
        default: false
    },
    verification_token: {
        type: String,
        select: false
    },
    reset_password_token: {
        type: String,
        select: false
    },
    reset_password_expires: {
        type: Date,
        select: false
    },
    last_login: {
        type: Date,
        default: null
    },
    security: {
        failed_login_attempts: {
            type: Number,
            default: 0
        },
        lock_until: {
            type: Date,
            default: null
        }
    }
}, {
    // Opción personalizada para que BaseService no use .lean() y permita la futura aplicación de getters para encriptación.
    useLean: false
});

// Aplicar plugin de auditoría (campos: active, created_at, modified_at, modified_by)
UserSchema.plugin(modelAuditPlugin);

// Middleware Pre-Save para Generar el username
UserSchema.pre('save', async function (next) {
    try {
        // Hashear la contraseña si es nuevo o se está modificando el password
        if (this.isNew || this.isModified('password')) {
            const salt = bcrypt.genSaltSync();
            const hashedPassword = bcrypt.hashSync(this.password, salt);
            //const hashedPassword = hash(this.password);
            this.password = hashedPassword;
        }

        // Generar username si corresponde
        if (this.roles && !this.roles.includes(rol.SYSTEM_ADMIN_ROLE)) {
            if (this.isModified('email') || !this.username) {
                const emailPart = this.email.split('@')[0].trim();
                this.username = emailPart.toLowerCase();
            }
        }

        // Generar avatar aleatorio si no se ha proporcionado uno
        if (!this.profile.avatar) {
            const gender = this.profile.gender.toLowerCase();
            const randomNumber = Math.floor(Math.random() * 23) + 1; // Número aleatorio entre 1 y 7
            this.profile.avatar = `admin-${gender}-${randomNumber}.png`;
        }

        next();
    } catch (err) {
        logger.error('Error en middleware pre-save de User:', err);
        next(err);
    }
});

// Índices para optimizar búsquedas
UserSchema.index({ company: 1 });
UserSchema.index({ roles: 1 });
// Índice para garantizar unicidad por compañía
UserSchema.index(
    { company: 1, username: 1 },
    { unique: true, name: 'unique_username_per_company' }
);
module.exports = model('User', UserSchema);