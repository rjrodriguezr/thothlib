const currency = Object.freeze({
    DOLAR: 'USD', // Dólar Estadounidense
    EURO: 'EUR', // Euro
    SOL: 'PEN', // Sol Peruano
});

const stockStatus = Object.freeze({
    DISCONTINUED: 'DSC', // Discontinued: El producto ha dejado de fabricarse o comercializarse de forma permanente.
    IN_STOCK: 'INS', //In Stock: El producto está disponible en inventario y listo para venta inmediata.
    LOW_STOCK: 'LST', //Low of Stock: El inventario está por debajo de un umbral crítico predefinido (ej.: menos del 10% de la capacidad máxima).
    OUT_OF_STOCK: 'OOS', // Out of stock: El producto no está disponible temporal o permanentemente en inventario.
});

const unitMeasureCategories = Object.freeze({
    ESPECIFICO: "SPC", // Productos con características únicas o identificadores exclusivos (ej.: lotes, SKUs personalizados).  
    FISICO: "PHS", // Productos tangibles que requieren manejo físico (ej.: electrónicos, muebles).
    GRANEL: "BLK", // Mercancía no empaquetada ni unitaria (ej.: cereales, químicos, materiales sueltos).
    OTROS: "OTH", // Categorías misceláneas o no clasificadas en los grupos anteriores (ej.: servicios, digital). 
    PESO: "WGT", // Productos medidos por kilogramos, gramos o toneladas (ej.: alimentos, materias primas).
    VOLUMEN: "VOL", // Productos medidos por capacidad (litros, metros cúbicos) (ej.: líquidos, gases).
});

const unitOfMeasure = Object.freeze({
  // Clave de categoría (PHS)
  [unitMeasureCategories.FISICO]: {
    // Clave de unidad (UNT) y valor a almacenar en BD
    UNT: "UNT", // Unidad
    PKG: "PKG", // Paquete
    BXC: "BXC", // Caja
    PLT: "PLT", // Palet
  },
  [unitMeasureCategories.PESO]: {
    KG: "KG", // Kilogramo
    GR: "GR", // Gramo
  },
  [unitMeasureCategories.VOLUMEN]: {
    LTR: "LTR", // Litro
    M3: "M3", // Metro Cúbico
  },
  [unitMeasureCategories.ESPECIFICO]: {
    LTC: "LTC", // Lote
    ROL: "ROL", // Rollo
    PAR: "PAR", // Par
    DOZ: "DOZ", // Docena
  },
  [unitMeasureCategories.GRANEL]: {
    BLK: "BLK", // Granel
    DRM: "DRM", // Bidón
  },
  [unitMeasureCategories.OTROS]: {
    BAG: "BAG", // Bolsa
    BTL: "BTL", // Botella
    CNT: "CNT", // Contenedor
  },
});

// DICCIONARIO PARA OBTENER EL CÓDIGO DE BD A PARTIR DEL TIPO DESCRIPTIVO
const movementCategories = Object.freeze({
    ADJUSTMENT_IN: 'ADIN',      // Código para Ajuste de Entrada
    ADJUSTMENT_OUT: 'ADOUT',    // Código para Ajuste de Salida
    SALE: 'SALE',               // Código para Venta
    PURCHASE_RECEIPT: 'PREC',   // Código para Recepción de Compra
    RETURN_CUSTOMER: 'RCIN',    // Código para Devolución de Cliente
    RETURN_SUPPLIER: 'RSOUT',   // Código para Devolución a Proveedor
    TRANSFER_OUT: 'TXOUT',      // Código para Transferencia Enviada
    TRANSFER_IN: 'TXIN'         // Código para Transferencia Recibida
});

const movementTypes = Object.freeze({
    INBOUND: 'INBD',
    OUTBOUND: 'OTBD',
});

const adjustmentReasons = {
    COUNT: 'CNT',  // Corrección por Conteo Físico (CouNT)
    LOSS:  'LSS',  // Baja por Merma / Daño (LoSS)
    EXPIRE: 'EXP', // Baja por Vencimiento (EXPiration)
    INITIAL: 'INI', // Carga de Saldo Inicial (INItial)
    FOUND: 'FND',  // Ingreso por Hallazgo (FouND)
    OTHER: 'OTH'   // Otros (OTHer)
};


module.exports = {
    adjustmentReasons,
    currency,
    movementCategories,
    movementTypes,
    stockStatus,
    unitMeasureCategories,
    unitOfMeasure,
};

