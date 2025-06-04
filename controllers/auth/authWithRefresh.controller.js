const jwt = require('jsonwebtoken');
const pool = require('../../db/db.js');

const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Falta el refresh token' });
  }

  try {
    // Verificar si el token está en la base de datos
    const result = await pool.query(
      'SELECT * FROM sesiones WHERE refresh_token = $1',
      [refreshToken]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Refresh token inválido o sesión inexistente' });
    }

    // Verificar la validez del refreshToken (firmado, sin expirar)
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        // Si el refreshToken expiró o fue modificado, eliminamos la sesión
        await pool.query('DELETE FROM sesiones WHERE refresh_token = $1', [refreshToken]);
        return res.status(403).json({ error: 'Refresh token expirado o inválido' });
      }

      const { userId } = decoded;

      // Buscar datos del usuario
      const userResult = await pool.query('SELECT * FROM usuarios WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const user = userResult.rows[0];

      // Generar nuevo accessToken
      const newAccessToken = jwt.sign(
        { userId: user.id, email: user.email, rol: user.rol },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      // Actualizar access_token y actualizado_en
      await pool.query(
        `UPDATE sesiones SET access_token = $1, actualizado_en = NOW() WHERE refresh_token = $2`,
        [newAccessToken, refreshToken]
      );

      return res.status(200).json({ accessToken: newAccessToken });
    });

  } catch (error) {
    console.error('Error al renovar el token:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { refreshAccessToken };
