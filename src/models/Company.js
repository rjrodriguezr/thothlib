const logger = require('../../lib/logger');
const { Schema, model } = require('mongoose');
const { modelAuditPlugin } = require('../middlewares');

const CompanySchema = Schema({
  name: {
    type: String,
    required: [true, 'name is required'],
    unique: true
  },
  email: {
    type: String,
    required: [true, 'email is required'],
    unique: true
  },
  description: {
    type: String,
    default: ''
  },
  responsible: {
    name: {
      type: String,
      required: [true, 'name is required'],
    },
    email: {
      type: String,
      default: ''
    },
    phone: {
      type: String,
      default: ''
    }
  },
  system_settings: {
    type: Schema.Types.Mixed,
    default: {
      // --- Tus configuraciones existentes ---
      igv_percentage: 0.18,
      currency_code: 'PEN',
      external_apis: {},
      email_config: {},
      payment_gateway: {},
      sequence_settings: {
        invoicePrefix: 'FAC',
        quotationPrefix: 'COT',
        invoiceStartNumber: 1,
        quotationStartNumber: 1,
        resetAnnually: true,
        paddingLength: 4
      },
      // --- Nuevas configuraciones para Meta ---
      meta_integrations: { // Agrupamos las configuraciones de Meta aquí
        metaAppId: null, // ID de la App de Meta general si se usa una para varios clientes
        whatsapp: {
          isEnabled: false,
          accessToken: null,
          phoneNumberId: null,
          appSecret: null, // Para verificar webhooks de WhatsApp
          webhookVerifyToken: null, // Token para la configuración inicial del webhook
        },
        messenger: {
          isEnabled: false,
          accessToken: null,
          pageId: null,
          appSecret: null,
          webhookVerifyToken: null,
        },
        instagram: {
          isEnabled: false,
          accessToken: null,
          instagramBusinessAccountId: null,
          appSecret: null,
          webhookVerifyToken: null,
        },
        clientWebhookUrl: null, // URL del webhook del cliente para recibir notificaciones de Meta
        eventSubscriptions: { // Qué eventos de Meta notificar al cliente
          whatsapp_messages: false,
          instagram_messages: false,
          facebook_comments: false,
          // ... otros eventos
        }
      },
      chat_setup: {
        isEnabled: false, // Control principal para activar/desactivar el widget
        config: {
          // -- Apariencia (Styling) --
          baseColor: "#1A73E8",
          headerTitle: "Soporte en línea",
          fontFamily: "'Inter', sans-serif",
          iconBottomDistance: 20,
          iconSideDistance: 20,
          widgetWidth: 350,
          widgetHeight: 480,
          textColorLight: "#FFFFFF",
          systemMessageColor: "#F1F1F1",
          textColorDark: "#212121",

          // -- Contenido y Textos (Localización) --
          welcomeMessage: "¡Hola! 👋 ¿Cómo podemos ayudarte hoy?",
          inputPlaceholder: "Escribe un mensaje...",
          sessionExpiredMessage: "Tu sesión ha finalizado. Por favor, reinicia el chat.",

          // -- Comportamiento (Behavioral) --
          minCharsToSend: 2,
          reconnectTimeout: 5000 // 5 segundos
        }
      }
    }
  },
  usageLimits: { // Para futura lógica de facturación o límites de consumo
    messagesSent: { type: Number, default: 0 },
    maxMessagesPerMonth: { type: Number, default: -1 } // -1 para ilimitado
  },
});

// Hook para guardar en Redis después de cada findOneAndUpdate
CompanySchema.post('findOneAndUpdate', async function (doc) {
  // El `doc` aquí es el documento DESPUÉS de la actualización.
  // `this` es la Query.
  if (doc) { // Verificar que `doc` no sea null (si no se encontró el documento para actualizar)
    try {
      const { companyService } = require('../services');
      await companyService.saveSettingInRedis(doc);
    } catch (error) {
      logger.error('Error al actualizar configuración en Redis tras "findOneAndUpdate":', error);
    }
  }
});

// Hook para guardar en Redis después de cada save o update
CompanySchema.post('save', async function (doc) {
  try {
    const { companyService } = require('../services');
    await companyService.saveSettingInRedis(doc);
  } catch (error) {
    logger.error('Error al guardar configuración en Redis:', error);
  }
});

// Aplicar el plugin de auditoría
CompanySchema.plugin(modelAuditPlugin);

module.exports = model('Company', CompanySchema);