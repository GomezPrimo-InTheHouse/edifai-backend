const jwt = require('jsonwebtoken');
const pool = require('../../connection/db.js');

const refreshAccessToken = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Falta el email' });
  }

  try {
    // Buscar al usuario por email, este email debe estar previamente logueado y se obtiene del token de acceso
    // o de la sesión activa del usuario.
    const userResult = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = userResult.rows[0];

    // Buscar la sesión activa del usuario usando su ID
    const sessionResult = await pool.query(
      'SELECT * FROM sesiones WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 1',
      [user.id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(403).json({ error: 'Sesión no encontrada para el usuario' });
    }

    const session = sessionResult.rows[0];
    const { refresh_token } = session;

    // Verificar la validez del refresh token
    jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        // Eliminar sesión si el refresh token expiró o fue modificado
        await pool.query('DELETE FROM sesiones WHERE refresh_token = $1', [refresh_token]);
        return res.status(403).json({ error: 'Refresh token inválido o expirado' });
      }

      // Verificación exitosa: generar un nuevo accessToken
      const newAccessToken = jwt.sign(
        { userId: user.id, email: user.email, rol: user.rol },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      // Actualizar la sesión con el nuevo accessToken
      await pool.query(
        `UPDATE sesiones SET access_token = $1, actualizado_en = NOW() WHERE refresh_token = $2`,
        [newAccessToken, refresh_token]
      );

      return res.status(200).json({ accessToken: newAccessToken });
    });
  } catch (error) {
    console.error('Error al renovar accessToken:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { refreshAccessToken };
