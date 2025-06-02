const axios = require('axios');


const basicAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Falta la cabecera Authorization' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  // Validamos contra las credenciales que definimos
  const validUser = 'admin';
  const validPassword = '1234';

  if (username === validUser && password === validPassword) {
    next(); // Pasa al siguiente middleware o ruta
  } else {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
};

module.exports = basicAuth;