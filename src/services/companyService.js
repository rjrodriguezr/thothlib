class CompanyService {
  #logger;
  #redisService;
  #constants;
  #CompanyModel;

  // #region [constructor]
  constructor({ logger, redisService, constants, Company }) {
    this.#logger = logger;
    this.#redisService = redisService;
    this.#constants = constants;
    this.#CompanyModel = Company;
  }
  //#endregion

  // #region [regis management]
  async #saveMainCompanySettings(companyId, systemSettings, companyName) {
    const redisKey = `${this.#constants.redisKeyPrefix.COMPANY_SETTINGS}:${companyId}`;
    await this.#redisService.setData(redisKey, systemSettings);
    this.#logger.verbose({ message: `Configuración principal de la empresa ${companyName} (${companyId}) guardada en Redis`, redisKey });
  }

  /**
   * Orquesta el guardado de la configuración de la empresa en Redis.
   * Este método guarda la configuración principal completa.
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

      this.#logger.verbose({ message: `Configuración de la empresa ${companyName} guardada en Redis`, companyId });
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
  //#endregion

  /**
   * Retrieves system settings for a company, using a cache-aside strategy.
   * 1. Tries to fetch the main settings from Redis cache.
   * 2. If not in cache, fetches the full company object from the database.
   * 3. If fetched from DB, it populates the cache for subsequent requests by calling `saveSettingInRedis`.
   *    This populates the main settings cache.
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
      // This will save the main settings.
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
}

module.exports = CompanyService;