const rateLimit = require('express-rate-limit');

// ── Límite general para todas las rutas ──────────────────────
const limiterGeneral = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,                  // 200 requests por IP cada 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes. Intentá de nuevo en 15 minutos.' },
});

// ── Límite estricto para auth ────────────────────────────────
const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,                   // 10 intentos de login por IP cada 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos de acceso. Intentá de nuevo en 15 minutos.' },
});

// ── Límite para market (subir comprobantes, publicar) ────────
const limiterMarket = rateLimit({
  windowMs: 60 * 1000,       // 1 minuto
  max: 30,                   // 30 requests por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes al Market. Esperá un momento.' },
});

module.exports = { limiterGeneral, limiterAuth, limiterMarket };