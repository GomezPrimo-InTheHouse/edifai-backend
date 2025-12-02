const jwt = require('jsonwebtoken');
const pool = require('../../connection/db.js');


const refreshAccessToken = async (req, res) => {
  console.log('Iniciando renovación de accessToken...');
  console.log('Datos recibidos:', req.body);
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Falta el email' });
  }

  try {
    // 1. Verificar si el usuario existe
    const userResult = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const user = userResult.rows[0];

    // 2. Buscar la sesión activa
    const sessionResult = await pool.query(
      'SELECT * FROM sesiones WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 1',
      [user.id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(403).json({ error: 'Sesión no encontrada para el usuario' });
    }

    const session = sessionResult.rows[0];
    const { refresh_token } = session;

    // 3. Verificar el refresh_token (promisificado)
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      });
    });

    // 4. Crear nuevo accessToken
    const newAccessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        rol: user.rol
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '15m' }
    );

    // 5. Actualizar la sesión con nuevo accessToken
    await pool.query(
      `UPDATE sesiones SET access_token = $1, actualizado_en = NOW() WHERE refresh_token = $2`,
      [newAccessToken, refresh_token]
    );

    // 6. Responder
    return res.status(200).json({ accessToken: newAccessToken });

  } catch (error) {
    console.error('Error al renovar accessToken:', error);

    // Si el error es de expiración del refresh_token:
    if (error.name === 'TokenExpiredError') {
      await pool.query('DELETE FROM sesiones WHERE refresh_token = $1', [refresh_token]);
      return res.status(403).json({ error: 'Refresh token expirado' });
    }

    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { refreshAccessToken };






