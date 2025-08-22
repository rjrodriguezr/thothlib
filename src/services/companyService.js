class CompanyService {
  #logger;
  #redisService;
  #constants;
  #defaultMetaIndexers;
  #CompanyModel;

  // #region [constructor]
  constructor({ logger, redisService, constants, Company }) {
    this.#logger = logger;
    this.#redisService = redisService;
    this.#constants = constants;
    this.#CompanyModel = Company;

    this.#defaultMetaIndexers = [
      {
        platformName: this.#constants.chatSources.WHATSAPP,
        tokenPath: ['meta_integrations', 'whatsapp', 'phoneNumberId'],
        redisKeyPrefix: this.#constants.redisKeyPrefix.WAP_PHONE_NUMBER_ID,
      },
      {
        platformName: this.#constants.chatSources.MESSENGER,
        tokenPath: ['meta_integrations', 'messenger', 'pageId'],
        redisKeyPrefix: this.#constants.redisKeyPrefix.MSN_PAGE_ID,
      },
      {
        platformName: this.#constants.chatSources.INSTAGRAM,
        tokenPath: ['meta_integrations', 'instagram', 'instagramBusinessAccountId'],
        redisKeyPrefix: this.#constants.redisKeyPrefix.IGM_BUSINESS_ACCOUNT_ID,
      }
    ];
  }
  //#endregion

  // #region [regis management]
  #getDeepValue(obj, pathArray) {
    return pathArray.reduce((currentObject, key) => {
      return currentObject && typeof currentObject === 'object' && currentObject[key] !== undefined ? currentObject[key] : undefined;
    }, obj);
  }

  async #saveMainCompanySettings(companyId, systemSettings, companyName) {
    const redisKey = `${this.#constants.redisKeyPrefix.COMPANY_SETTINGS}:${companyId}`;
    await this.#redisService.setData(redisKey, systemSettings);
    this.#logger.verbose({ message: `Configuración principal de la empresa ${companyName} (${companyId}) guardada en Redis`, redisKey });
  }

  async #processAndSaveSecondaryIndex(companyId, systemSettings, indexerConfig) {
    const { platformName, tokenPath, redisKeyPrefix } = indexerConfig;
    const tokenValue = this.#getDeepValue(systemSettings, tokenPath);

    if (tokenValue) {
      const secondaryIndexRedisKey = `${redisKeyPrefix}:${tokenValue}`;
      await this.#redisService.setData(secondaryIndexRedisKey, companyId);
      this.#logger.verbose({
        message: `Índice secundario para ${platformName} creado`,
        companyId,
        redisKey: secondaryIndexRedisKey
      });
    } else {
      this.#logger.verbose({ message: `No se encontró token para ${platformName} en la configuración de la empresa ${companyId}. No se creó índice secundario.`, companyId, platformName });
    }
  }

  /**
   * Orquesta el guardado de la configuración de la empresa y sus índices secundarios en Redis.
   * Este método guarda la configuración principal completa y luego itera sobre todos los
   * indexadores definidos para crear las búsquedas inversas (ej. buscar companyId por phoneNumberId).
   *
   * @param {object} company - Objeto de la compañía con _id, name y system_settings.
   * @throws {Error} Si el objeto `company` no es válido o faltan propiedades esenciales.
   * @async
   */
  async saveSettingInRedis(company) {
    // --- 1. Validación de Entrada ---
    // Se asegura que el objeto `company` y sus propiedades críticas (_id, system_settings) existan.
    // Esto previene errores en los pasos siguientes y proporciona un mensaje de error claro.
    if (!company || !company._id || !company.system_settings) {
      this.#logger.error({
        message: 'Objeto `company` inválido o faltan `_id` o `system_settings`.',
        companyDetails: { id: company?._id, hasSettings: !!company?.system_settings }
      });
      throw new Error('Objeto `company` inválido o faltan `_id` o `system_settings`.');
    }

    // --- 2. Extracción de Datos ---
    // Se extraen las variables necesarias del objeto para mayor legibilidad del código.
    const companyId = company._id;
    const systemSettings = company.system_settings;
    const companyName = company.name || companyId.toString();

    try {
      // --- 3. Guardado de la Configuración Principal ---
      // Se guarda el objeto `system_settings` completo en una clave principal de Redis.
      // Esto permite recuperar toda la configuración de una empresa con una sola consulta a Redis.
      await this.#saveMainCompanySettings(companyId, systemSettings, companyName);

      // --- 4. Procesamiento de Índices Secundarios ---
      // Se itera sobre la lista de indexadores para crear claves de búsqueda adicionales.
      const indexers = this.#defaultMetaIndexers;
      for (const indexerConfig of indexers) {
        try {
          // Cada índice se procesa de forma independiente para aumentar la resiliencia.
          // Un fallo en un índice (ej. un token faltante) no detendrá el procesamiento de los demás.
          await this.#processAndSaveSecondaryIndex(companyId, systemSettings, indexerConfig);
        } catch (error) {
          // Si un índice secundario falla, se registra el error detallado pero el proceso continúa.
          this.#logger.error({
            message: `Error al procesar/guardar índice secundario para ${indexerConfig.platformName}`,
            companyId,
            platform: indexerConfig.platformName,
            errorMessage: error.message,
            stack: error.stack // El stack es útil para la depuración.
          });
        }
      }

      this.#logger.verbose({ message: `Todos los datos relevantes de la empresa ${companyName} procesados para Redis`, companyId });
    } catch (error) {
      // --- 5. Manejo de Errores Generales ---
      // Captura errores del guardado principal o cualquier otro error no capturado en el bucle.
      this.#logger.error({
        message: `Error general al guardar datos de la empresa ${companyName} en Redis`,
        companyId,
        errorMessage: error.message,
        stack: error.stack
      });
      // Se relanza el error para que el llamador (ej. el hook de Mongoose) sepa que algo falló.
      throw error;
    }
  }

  /**
   * Actualiza en Redis el índice secundario para un canal de comunicación específico de una empresa.
   * Por ejemplo, actualiza la referencia del 'phoneNumberId' de WhatsApp al ID de la empresa.
   * Este método es útil cuando solo cambia la configuración de un canal y no se necesita
   * re-indexar toda la configuración de la empresa.
   *
   * @param {object} company - El objeto completo de la compañía, debe contener _id y system_settings.
   * @param {string} channel - El canal a actualizar (ej. 'whatsapp', 'messenger'). Debe existir en los indexadores.
   * @throws {Error} Si los parámetros son inválidos o si no se encuentra un indexador para el canal.
   * @async
   */
  async updateIndexForChannelInRedis(company, channel) {
    // --- 1. Validación de Entradas ---
    // Se realizan las mismas validaciones que en el método principal para garantizar la integridad de los datos.
    if (!company || !company._id || !company.system_settings) {
      this.#logger.error({
        message: 'Objeto `company` inválido o faltan `_id` o `system_settings`.',
        companyId: company?._id,
        hasSettings: !!company?.system_settings
      });
      throw new Error('Objeto `company` inválido.');
    }
    if (!channel) {
      this.#logger.error({ message: 'El parámetro `channel` es obligatorio.', companyId: company._id });
      throw new Error('El parámetro `channel` es obligatorio.');
    }

    const companyId = company._id;
    const companyName = company.name || companyId.toString();

    try {
      // --- 2. Encontrar la Configuración del Indexador para el Canal Especificado ---
      // Se busca en la lista de indexadores la configuración que corresponde al canal solicitado.
      const indexerConfig = this.#defaultMetaIndexers.find(
        (indexer) => indexer.platformName === channel
      );

      // Si no se encuentra una configuración para el canal, es un error de lógica o un canal no soportado.
      if (!indexerConfig) {
        this.#logger.warn({ message: `No se encontró configuración de indexador para el canal '${channel}'.`, companyId });
        throw new Error(`Configuración de indexador no encontrada para el canal: ${channel}`);
      }

      this.#logger.verbose({ message: `Procesando índice secundario para el canal '${channel}' de la empresa ${companyName}`, companyId });

      // --- 3. Procesar y Guardar solo ese Índice Secundario ---
      // Se reutiliza la lógica de procesamiento de índice, pero solo para el canal especificado.
      await this.#processAndSaveSecondaryIndex(companyId, company.system_settings, indexerConfig);

      this.#logger.info({ message: `Índice secundario para '${channel}' de la empresa ${companyName} guardado exitosamente`, companyId });
    } catch (error) {
      // --- 4. Manejo de Errores ---
      // Si falla cualquier paso (encontrar el indexador, guardarlo), se captura y registra aquí.
      this.#logger.error({
        message: `Error al actualizar el índice de Redis para el canal '${channel}' de la empresa ${companyName}`,
        companyId,
        channel,
        errorMessage: error.message,
        stack: error.stack
      });
      // Relanzar el error para que el código que llamó a esta función se entere del fallo.
      throw error;
    }
  }
  //#endregion

  /**
   * Retrieves system settings for a company, using a cache-aside strategy.
   * 1. Tries to fetch the main settings from Redis cache.
   * 2. If not in cache, fetches the full company object from the database.
   * 3. If fetched from DB, it populates the entire cache (main settings and secondary indexes)
   *    for subsequent requests by calling `saveSettingInRedis`.
   *
   * @param {string} companyId The ID of the company to fetch settings for.
   * @returns {Promise<object|null>} The system_settings object, or null if not found.
   */
  async getSystemSettings(companyId) {
    const redisKey = `${this.#constants.redisKeyPrefix.COMPANY_SETTINGS}:${companyId}`;

    try {
      if (!companyId) {
        throw new Error('companyId is required');
      }
      // 1. Try to get from Redis first
      const cachedSettings = await this.#redisService.getData(redisKey);
      if (cachedSettings) {
        this.#logger.verbose({ message: `Cache HIT for company settings`, companyId, redisKey });
        // The service stores objects, so no need to parse unless it's configured differently
        return cachedSettings;
      }

      this.#logger.verbose({ message: `Cache MISS for company settings. Fetching from DB to repopulate.`, companyId });

      // 2. If not in cache, get the full company object from DB
      // We need `_id`, `name`, and `system_settings` for `saveSettingInRedis`
      const company = await this.#CompanyModel.findOne(
        { _id: companyId, active: true },
        { name: 1, system_settings: 1 } // Select fields needed by saveSettingInRedis
      ).lean();

      if (!company || !company.system_settings) {
        this.#logger.warn({ message: `Company or its settings not found in DB`, companyId });
        return null; // Not found
      }

      // 3. Populate cache for next time by calling the main save method.
      // This will save the main settings AND all secondary indexes.
      await this.saveSettingInRedis(company);
      this.#logger.info({ message: `Cache fully repopulated for company`, companyId });

      return company.system_settings;

    } catch (error) {
      this.#logger.error({
        message: `Error in getSystemSettings for company`,
        companyId,
        errorMessage: error.message,
        stack: error.stack
      });
      // Re-throw to let the caller (e.g., a controller) handle it
      throw error;
    }
  }

  /**
   * Retrieves a company ID by a specific integration attribute (e.g., WhatsApp phone number ID).
   * It implements a cache-aside strategy:
   * 1. Tries to fetch the company ID from a secondary index in Redis.
   * 2. If the ID is found in the cache (cache hit), it's returned immediately.
   * 3. If not in the cache (cache miss), it queries the database as a fallback.
   * 4. If the company is found in the database, it asynchronously updates the Redis index
   *    to speed up subsequent requests.
   *
   * @param {string} channel The communication channel (e.g., 'whatsapp', 'messenger').
   * @param {string} attribute The unique identifier for that channel (e.g., a phone number ID or page ID).
   * @returns {Promise<string|null>} The company ID as a string, or null if not found.
   */
  async getIdByIntegration(channel, attribute) {
    try {
      if (!channel || !attribute) {
        throw new Error('channel and attribute are required');
      }

      // --- 1. Find the correct indexer configuration for the channel ---
      const indexerConfig = this.#defaultMetaIndexers.find(
        (indexer) => indexer.platformName === channel
      );

      if (!indexerConfig) {
        this.#logger.warn({ message: `Intento de búsqueda con canal no válido`, channel });
        return null;
      }

      // --- 2. Try to fetch from Redis first (Cache-Aside) ---
      const redisKey = `${indexerConfig.redisKeyPrefix}:${attribute}`;
      const cachedCompanyId = await this.#redisService.getData(redisKey);

      if (cachedCompanyId) {
        this.#logger.verbose({ message: `Cache HIT for companyId by integration`, channel, attribute, redisKey, companyId: cachedCompanyId });
        return cachedCompanyId;
      }

      this.#logger.verbose({ message: `Cache MISS for companyId by integration. Fetching from DB.`, channel, attribute, redisKey });

      // --- 3. If not in cache, fetch from Database (Fallback) ---
      const integrationField = `system_settings.${indexerConfig.tokenPath.join('.')}`;
      const filter = {
        active: true,
        [integrationField]: attribute
      };

      this.#logger.verbose({ message: `Buscando compañía por integración en DB`, filter });
      const company = await this.#CompanyModel.findOne(filter, { _id: 1, name: 1, system_settings: 1 }).lean();

      if (company) {
        this.#logger.verbose({ message: `Compañía encontrada por integración`, companyId: company._id, companyName: company.name, channel, attribute });

        // --- 4. Asynchronously update the cache for the next request ---
        this.updateIndexForChannelInRedis(company, channel)
          .then(() => {
            this.#logger.info({
              message: `[Background Job] Cache for channel ${channel} repopulated after DB fallback`,
              companyId: company._id,
              companyName: company.name
            });
          })
          .catch(error => {
            this.#logger.error({
              message: `[Background Job] Failed to repopulate cache for channel ${channel}`,
              companyId: company._id,
              errorMessage: error.message,
              stack: error.stack
            });
          });

        return company._id;
      } else {
        this.#logger.warn({ message: `No se encontró una compañía activa con los criterios de integración`, channel, attribute });
        return null;
      }
    } catch (error) {
      this.#logger.error({
        message: "Ocurrió un error inesperado en getIdByIntegration",
        channel,
        attribute,
        errorMessage: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = CompanyService;