// middleware/rateLimits.mjs
import rateLimit from 'express-rate-limit';

const QUINCE_MIN = 15 * 60 * 1000;

const base = {
  windowMs: QUINCE_MIN,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
};

// Límite general para toda la API
export const limiteGeneral = rateLimit({ ...base, limit: 600 });

// Login: 10 intentos fallidos cada 15 minutos por IP
export const limiteLogin = rateLimit({ ...base, limit: 10, skipSuccessfulRequests: true });

// Inicio de pagos
export const limitePagos = rateLimit({ ...base, limit: 30 });

// Consulta de recibos (evita que alguien recorra números de orden)
export const limiteConsultaPagos = rateLimit({ ...base, limit: 60 });
