const pool = require('../../db/db.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');

require('dotenv').config();

const login = async (req, res) => {
  console.log('Login request received:', req.user);
  const { user } = req; // viene desde el middleware basicAuth
  const { totp } = req.body;

  try {
    // Buscar el usuario completo (incluye seed y rol)
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [user.email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const usuario = result.rows[0];

    // Verificar TOTP
    const esValidoTOTP = speakeasy.totp.verify({
      secret: usuario.totp_seed,
      encoding: 'base32',
      token: totp,
      window: 1 // tolerancia de 30 segundos hacia adelante o atrás
    });

    if (!esValidoTOTP) {
      return res.status(401).json({ error: 'Código TOTP inválido' });
    }

    // Generar tokens
    const accessToken = jwt.sign(
      { userId: usuario.id, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: usuario.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Guardar sesión
    await pool.query(`
      INSERT INTO sesiones (usuario_id, access_token, refresh_token)
      VALUES ($1, $2, $3)
    `, [usuario.id, accessToken, refreshToken]);

    res.json({ accessToken, refreshToken });

  } catch (err) {
    console.error('Error en loginConTOTP:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { login };
