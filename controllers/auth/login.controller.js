const pool = require('../../connection/db.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');

require('dotenv').config();

const login = async (req, res) => {
  console.log('Login request received:', req.user);
  const { user } = req; // viene desde el middleware basicAuth
  const { totp } = req.body; // codigo totp: esto debería venir en el body del request, se utiliza authenticator de Google.

  try {
    // Buscar el usuario completo (incluye seed y rol)
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND estado_id = 1', [user.email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const usuario = result.rows[0];

    // Verificar TOTP
    const esValidoTOTP = speakeasy.totp.verify({
      secret: usuario.totp_seed,
      encoding: 'base32',
      token: totp,
      window: 1 
    });

    if (!esValidoTOTP) {
      return res.status(401).json({ error: 'Código TOTP inválido' });
    }

    // Generar tokens
    const accessToken = jwt.sign(
      { userId: usuario.id, 
        email: usuario.email, 
        rol: usuario.rol },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: usuario.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Guardar sesión
    const estadoSesionActivaId = 1;
    await pool.query(`
      INSERT INTO sesiones (usuario_id, access_token, refresh_token, estado_id)
      VALUES ($1, $2, $3, $4)
    `, [usuario.id, accessToken, refreshToken, estadoSesionActivaId]);

    res.json({ accessToken, refreshToken });

  } catch (err) {
    console.error('Error en loginConTOTP:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};



module.exports = { login };
