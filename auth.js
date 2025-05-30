// auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { registrarHistorial } = require('./microservicio-historial');
const pool = require('./db/db.js');

//llamo a la funcion de refresh token
const { startAutoRefresh } = require('./utils/autoRefresh');

const JWT_SECRET = process.env.JWT_SECRET;

// Verificamosssss el token JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso no autorizado: Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {

      // en esta parte deberia agregar el refresh token,

      // en caso real de que el token sea invalido o haya expirado
      // deberia intentar refrescarlo mediante el refresh token
      
      startAutoRefresh();
      // Si el token es inválido o ha expirado, se puede intentar refrescarlo
      
      return res.status(401).json({ error: 'Acceso no autorizado: Token inválido o expirado' });

    }
    req.user = decoded;
    next();
  });
};

// Generamos el Token JWT

const generateToken = (user) => {


  return jwt.sign(user, JWT_SECRET, { expiresIn: '10m' });


};

// Middleware de autenticación básica para login que podemos pasarlo en el body
const authenticateUser = async (req, res, next) => {
  const { username, password } = req.body;


      
  if (!username || !password) {

    await registrarHistorial({
        username:'no proporcionado',
        accion: 'login',
        estado: 'error',
        mensaje: 'Usuario no encontrado o pass incorrecta'
      });

    return res.status(400).json({ error: 'El nombre de usuario y la contraseña son requeridos' });
  }

  // Aquí se podrían obtener las credenciales desde variables de entorno o una base de datos
  const validUsername = process.env.AUTH_USERNAME;
  const validPassword = process.env.AUTH_PASSWORD;

  if (validPassword !== password) {
      await registrarHistorial({
        username,
        accion: 'login',
        estado: 'error',
        mensaje: 'Contraseña incorrecta'
      });
      }
        if (validUsername !== username) {
      await registrarHistorial({
        username,
        accion: 'login',
        estado: 'error',
        mensaje: 'Usuario distinto o incorrecta'
      });
      }
  if (username === validUsername && password === validPassword) {
    req.user = { username };
    next();
  } else {
    res.status(401).json({ error: 'Credenciales inválidas' });
  }
};

// act1: Implementar refresh tokens: Para obtener nuevos tokens de acceso sin volver a autenticar al usuario

const refreshTokens = [];

const generateRefreshToken = (user) => {
  const refreshToken = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '24hr' });
  refreshTokens.push(refreshToken);
  console.log('Refresh token generado:', refreshToken);
  return refreshToken;
};






module.exports = {
  verifyToken,
  generateToken,
  authenticateUser,
  generateRefreshToken
};