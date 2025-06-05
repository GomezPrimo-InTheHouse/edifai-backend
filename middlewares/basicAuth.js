const pool = require('../connection/db.js');
const bcrypt = require('bcrypt');

const basicAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Cabecera Authorization básica requerida' });
  }

  const base64 = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64, 'base64').toString('ascii');
  const [email, password] = credentials.split(':');

  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const usuario = result.rows[0];
    const match = await bcrypt.compare(password, usuario.password_hash);

    if (!match) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    req.user = { id: usuario.id, email: usuario.email };
    next();
  } catch (error) {
    console.error('Error en basicAuth:', error);
    res.status(500).json({ error: 'Error en autenticación básica' });
  }
};

module.exports = basicAuth;
