const rateLimit = require('express-rate-limit');

const limiterGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // ← subir a 1000 mientras se estabiliza
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes. Intentá de nuevo en 15 minutos.' },
});

const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // ← subir a 50
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos de acceso. Intentá de nuevo en 15 minutos.' },
});

const limiterMarket = rateLimit({
  windowMs: 60 * 1000,
  max: 100, // ← subir a 100
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes al Market. Esperá un momento.' },
});

module.exports = { limiterGeneral, limiterAuth, limiterMarket };