// middlewares/verificarTotpSiCorresponde.js
const speakeasy = require('speakeasy');

const verificarTotpSiCorresponde = (req, res, next) => {
  const { usuario } = req;

  if (!usuario) {
    return res.status(400).json({ error: 'Usuario no cargado en la solicitud' });
  }

  if (usuario.rol_nombre === 'TRABAJADOR') {
    return next(); // Trabajador NO requiere TOTP
  }

  const { totp } = req.body;

  if (!usuario.totp_seed) {
    return res.status(403).json({ error: 'Usuario sin TOTP configurado' });
  }

  const verificado = speakeasy.totp.verify({
    secret: usuario.totp_seed,
    encoding: 'base32',
    token: totp,
    window: 1
  });

  if (!verificado) {
    return res.status(401).json({ error: 'Código TOTP inválido' });
  }

  next();
};

module.exports = verificarTotpSiCorresponde;
