const axios = require('axios');
const logger = require('./logger');

const internalApiClient = axios.create({
    timeout: process.env.AXIOS_TIME_OUT || 5000,
    // baseURL no se establece aquí, ya que se determinará por servicio.
});

// Interceptor de solicitud
internalApiClient.interceptors.request.use(
    (axiosReqConfig) => {
        // La URL original pasada a axios (ej. '/users/profile') se usará como la ruta relativa.
        const originalRelativeUrl = axiosReqConfig.url;
        logger.debug(`[AxiosClient] Interceptando solicitud para ruta relativa: ${originalRelativeUrl}`);

        return axiosReqConfig;
    },
    (error) => {
        logger.error(`[AxiosClient] Error en el interceptor de solicitud -> error:${error.message}`);
        return Promise.reject(error);
    }
);

// Interceptor de respuesta (ejemplo, sin cambios respecto al anterior)
internalApiClient.interceptors.response.use(
    (response) => {
        logger.debug(`[AxiosClient] Respuesta de ${response.config.url} con estado ${response.status}`);
        return response;
    },
    (error) => {
        const url = error.config?.url;
        const status = error.response?.status;
        const data = error.response?.data;
        logger.error(`[AxiosClient] Error en respuesta de ${url || 'URL desconocida'}. Estado: ${status || 'N/A'}. Datos: ${JSON.stringify(data || error.message)}`);
        return Promise.reject(error);
    }
);

module.exports = internalApiClient;