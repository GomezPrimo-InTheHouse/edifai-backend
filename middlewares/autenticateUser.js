// authenticateUser.js
const pool = require('../db/db.js'); 

const authenticateUser = async (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    await registrarHistorial({
      username: username || 'no proporcionado',
      accion: 'login',
      estado: 'error',
      mensaje: 'Faltan credenciales',
    });

    return res.status(400).json({ error: 'El nombre de usuario y la contraseña son requeridos' });
  }

  const validUsername = process.env.AUTH_USERNAME;
  const validPassword = process.env.AUTH_PASSWORD;

  let mensajeError = '';

  if (username !== validUsername) {
    mensajeError = 'Usuario incorrecto';
  } else if (password !== validPassword) {
    mensajeError = 'Contraseña incorrecta';
  }

  if (mensajeError) {
    await registrarHistorial({
      username,
      accion: 'login',
      estado: 'error',
      mensaje: mensajeError,
    });

    return res.status(401).json({ error: mensajeError });
  }

  // Si todo está OK
  req.user = { username };
  await registrarHistorial({
    username,
    accion: 'login',
    estado: 'éxito',
    mensaje: 'Acceso concedido',
  });

  next();
};

module.exports = authenticateUser;
