// middlewares/validarCredenciales.js
const bcrypt = require('bcrypt');
const db = require('../connection/db.js');

const validarCredenciales = async (req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Falta encabezado Authorization' });
  }

  const [email, password] = Buffer
    .from(auth.split(' ')[1], 'base64')
    .toString()
    .split(':');

  try {
    const result = await db.query(`
      SELECT u.*, r.nombre AS rol_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE u.email = $1 AND u.estado_id = 1
    `, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    const usuario = result.rows[0];

    const passwordOk = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    req.usuario = usuario; // lo dejamos listo para el siguiente middleware y controller
    next();
  } catch (error) {
    console.error('Error en validarCredenciales:', error);
    return res.status(500).json({ error: 'Error interno en autenticación' });
  }
};

module.exports = validarCredenciales;
