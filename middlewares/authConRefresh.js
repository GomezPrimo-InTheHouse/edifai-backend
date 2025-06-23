const jwt = require('jsonwebtoken');
const axios = require('axios');

const autenticacionConRefreshAutomatica = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token no proporcionado' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    if (error.name !== 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token inválido' });
    }

    // Token expirado → intentar renovar
    try {
      const payload = jwt.decode(token);
      const email = payload?.email;
      if (!email) return res.status(403).json({ error: 'No se puede renovar el token: falta email' });

      const response = await axios.post(`http://localhost:7001/auth/refresh-token`, { email });

      const nuevoAccessToken = response.data.accessToken;

      // Verificar el nuevo token y continuar
      const nuevoDecoded = jwt.verify(nuevoAccessToken, process.env.JWT_SECRET);
      req.user = nuevoDecoded;
      req.newAccessToken = nuevoAccessToken;

      res.setHeader('x-new-access-token', nuevoAccessToken);
      return next();
    } catch (refreshError) {
      console.error('Fallo al renovar token expirado:', refreshError.message);
      return res.status(403).json({ error: 'No se pudo renovar el token' });
    }
  }
};

module.exports = autenticacionConRefreshAutomatica;
