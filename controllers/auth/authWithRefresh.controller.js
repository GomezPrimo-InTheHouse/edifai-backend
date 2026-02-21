// const jwt = require('jsonwebtoken');
// const pool = require('../../connection/db.js');

// const refreshAccessToken = async (req, res) => {
//   console.log('Iniciando renovación de accessToken...');
//   console.log('Datos recibidos:', req.body);
//   const { email } = req.body;

//   if (!email) {
//     return res.status(400).json({ error: 'Falta el email' });
//   }

//   try {
//     // 1. Verificar si el usuario existe
//     const userResult = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
//     if (userResult.rows.length === 0) {
//       return res.status(404).json({ error: 'Usuario no encontrado' });
//     }
//     const user = userResult.rows[0];

//     // 2. Buscar la sesión activa
//     const sessionResult = await pool.query(
//       'SELECT * FROM sesiones WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 1',
//       [user.id]
//     );

//     if (sessionResult.rows.length === 0) {
//       return res.status(403).json({ error: 'Sesión no encontrada para el usuario' });
//     }

//     const session = sessionResult.rows[0];
//     const { refresh_token } = session;

//     // 3. Verificar el refresh_token (promisificado)
//     const decoded = await new Promise((resolve, reject) => {
//       jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
//         if (err) return reject(err);
//         resolve(decoded);
//       });
//     });

//     // 4. Crear nuevo accessToken
//     const newAccessToken = jwt.sign(
//       {
//         userId: user.id,
//         email: user.email,
//         rol: user.rol
//       },
//       process.env.JWT_SECRET_KEY,
//       { expiresIn: '15m' }
//     );

//     // 5. Actualizar la sesión con nuevo accessToken
//     await pool.query(
//       `UPDATE sesiones SET access_token = $1, actualizado_en = NOW() WHERE refresh_token = $2`,
//       [newAccessToken, refresh_token]
//     );

//     // 6. Responder
//     return res.status(200).json({ accessToken: newAccessToken });

//   } catch (error) {
//     console.error('Error al renovar accessToken:', error);

//     // Si el error es de expiración del refresh_token:
//     if (error.name === 'TokenExpiredError') {
//       await pool.query('DELETE FROM sesiones WHERE refresh_token = $1', [refresh_token]);
//       return res.status(403).json({ error: 'Refresh token expirado' });
//     }

//     return res.status(500).json({ error: 'Error interno del servidor' });
//   }
// };

// module.exports = { refreshAccessToken };



// controllers/refreshToken.controller.js (o dentro de auth.controller.js)
const jwt = require('jsonwebtoken');
const pool = require('../../connection/db.js');

const refreshAccessToken = async (req, res) => {
  console.log('Iniciando renovación de accessToken...');
  console.log('Datos recibidos:', req.body);

  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Falta refreshToken en el body.' });
  }

  let session;
  let user;

  try {
    // 1. Buscar la sesión que tiene este refreshToken y está activa (estado_id = 1)
    const sessionResult = await pool.query(
      `
      SELECT * 
      FROM sesiones 
      WHERE refresh_token = $1 
        AND estado_id = 1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [refreshToken]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(403).json({ error: 'Sesión no encontrada o inactiva para ese refresh token.' });
    }

    session = sessionResult.rows[0];

    // 2. Buscar el usuario asociado a la sesión
    const userResult = await pool.query(
      `
      SELECT u.*, r.nombre AS rol_nombre
      FROM usuarios u
      LEFT JOIN roles r ON u.rol_id = r.id
      WHERE u.id = $1
        AND u.estado_id = 1
      `,
      [session.usuario_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado o inactivo.' });
    }

    user = userResult.rows[0];

    // 3. Verificar el refresh_token con JWT
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, decodedPayload) => {
        if (err) return reject(err);
        resolve(decodedPayload);
      });
    });

    // (Opcional) verificar que decoded.userId == user.id, por seguridad extra
    if (decoded.userId !== user.id) {
      return res.status(403).json({ error: 'Refresh token no coincide con el usuario.' });
    }

    // 4. Crear nuevo accessToken
    const newAccessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        rol_id: user.rol_id,
        rol_nombre: user.rol_nombre,
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '15m' }
    );

    // 5. Actualizar la sesión con el nuevo accessToken
    await pool.query(
      `
      UPDATE sesiones
      SET access_token = $1,
          updated_at   = NOW()
      WHERE id = $2
      `,
      [newAccessToken, session.id]
    );

    // 6. Responder con el nuevo accessToken
    return res.status(200).json({ accessToken: newAccessToken });

  } catch (error) {
    console.error('Error al renovar accessToken:', error);

    // Si el error es de expiración del refresh_token, borramos la sesión
    if (error.name === 'TokenExpiredError') {
      if (session && session.refresh_token) {
        await pool.query('DELETE FROM sesiones WHERE refresh_token = $1', [session.refresh_token]);
      }
      return res.status(403).json({ error: 'Refresh token expirado. Debe iniciar sesión nuevamente.' });
    }

    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { refreshAccessToken };



