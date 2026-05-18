


// controllers/refreshToken.controller.js (o dentro de auth.controller.js)
const jwt = require('jsonwebtoken');
const pool = require('../../connection/db.js');

const refreshAccessToken = async (req, res) => {
  console.log('🔄 [REFRESH] Solicitud recibida');
  console.log('🔄 [REFRESH] Body:', req.body);

  const { refreshToken } = req.body;

  if (!refreshToken) {
    console.log('❌ [REFRESH] No vino refreshToken en el body');
    return res.status(400).json({ error: 'Falta refreshToken en el body.' });
  }

  let session;
  let user;

  try {
    const sessionResult = await pool.query(
      `SELECT * FROM sesiones WHERE refresh_token = $1 AND estado_id = 1 ORDER BY created_at DESC LIMIT 1`,
      [refreshToken]
    );

    if (sessionResult.rows.length === 0) {
      console.log('❌ [REFRESH] Sesión no encontrada o inactiva');
      return res.status(403).json({ error: 'Sesión no encontrada o inactiva para ese refresh token.' });
    }

    session = sessionResult.rows[0];
    console.log('✅ [REFRESH] Sesión encontrada, usuario_id:', session.usuario_id);

    const userResult = await pool.query(
      `SELECT u.*, r.nombre AS rol_nombre FROM usuarios u LEFT JOIN roles r ON u.rol_id = r.id WHERE u.id = $1 AND u.estado_id = 1`,
      [session.usuario_id]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ [REFRESH] Usuario no encontrado o inactivo');
      return res.status(404).json({ error: 'Usuario no encontrado o inactivo.' });
    }

    user = userResult.rows[0];
    console.log('✅ [REFRESH] Usuario encontrado:', user.email);

    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, decodedPayload) => {
        if (err) {
          console.log('❌ [REFRESH] JWT verify falló:', err.name, err.message);
          return reject(err);
        }
        resolve(decodedPayload);
      });
    });

    if (decoded.userId !== user.id) {
      console.log('❌ [REFRESH] userId del token no coincide con el usuario de la sesión');
      return res.status(403).json({ error: 'Refresh token no coincide con el usuario.' });
    }

    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email, rol_id: user.rol_id, rol_nombre: user.rol_nombre },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '15m' }
    );

    await pool.query(
      `UPDATE sesiones SET access_token = $1, updated_at = NOW() WHERE id = $2`,
      [newAccessToken, session.id]
    );

    console.log('✅ [REFRESH] Nuevo accessToken generado y sesión actualizada para:', user.email);
    return res.status(200).json({ accessToken: newAccessToken });

  } catch (error) {
    console.error('💥 [REFRESH] Error:', error.name, error.message);

    if (error.name === 'TokenExpiredError') {
      console.log('❌ [REFRESH] RefreshToken expirado, eliminando sesión');
      if (session?.refresh_token) {
        await pool.query('DELETE FROM sesiones WHERE refresh_token = $1', [session.refresh_token]);
      }
      return res.status(403).json({ error: 'Refresh token expirado. Debe iniciar sesión nuevamente.' });
    }

    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { refreshAccessToken };



