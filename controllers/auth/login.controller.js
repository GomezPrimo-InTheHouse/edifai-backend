// controllers/login.controller.js (o auth.controller.js, según tu estructura)
const pool = require('../../connection/db.js');
const jwt = require('jsonwebtoken');
const { verificarTotp } = require('../../utils/auth/totp-util.js');

require('dotenv').config();

// const login = async (req, res) => {
//   // 👇 viene del middleware validarCredenciales
//   const usuario = req.usuario;
//   const { totp } = req.body;

//   console.log('Login request received, usuario desde middleware:', usuario?.email);

//   if (!usuario) {
//     return res.status(401).json({
//       error: 'No se recibieron credenciales válidas desde el middleware.',
//     });
//   }

//   if (!totp) {
//     return res.status(400).json({ error: 'Falta el código TOTP en el body.' });
//   }

//   try {
//     // Verificar que tenga TOTP configurado
//     if (!usuario.totp_seed) {
//       return res.status(400).json({
//         error: 'El usuario no tiene 2FA configurado. Contacte al administrador.',
//       });
//     }

//     // Verificar TOTP usando el helper
//     const esValidoTOTP = verificarTotp(totp, usuario.totp_seed);

//     if (!esValidoTOTP) {
//       return res.status(401).json({ error: 'Código TOTP inválido' });
//     }

//     // Generar tokens
//     const accessToken = jwt.sign(
//       {
//         userId: usuario.id,
//         email: usuario.email,
//         rol_id: usuario.rol_id,
//         rol_nombre: usuario.rol_nombre, // viene del JOIN en el middleware
//       },
//       process.env.JWT_SECRET_KEY,
//       { expiresIn: '1h' }
//     );

//     const refreshToken = jwt.sign(
//       { userId: usuario.id },
//       process.env.JWT_REFRESH_SECRET,
//       { expiresIn: '7d' }
//     );

//     // Guardar sesión (estado 1 = activa)
//     const estadoSesionActivaId = 1;
//     await pool.query(
//       `
//       INSERT INTO sesiones (usuario_id, access_token, refresh_token, estado_id)
//       VALUES ($1, $2, $3, $4)
//       `,
//       [usuario.id, accessToken, refreshToken, estadoSesionActivaId]
//     );

//     return res.json({
//       accessToken,
//       refreshToken,       
//       user: {
//         id: usuario.id,
//         email: usuario.email,
//         rol_id: usuario.rol_id,
//         rol_nombre: usuario.rol_nombre,
//       },
//      });
//   } catch (err) {
//     console.error('Error en login:', err);
//     return res.status(500).json({ error: 'Error interno del servidor' });
//   }
// };
const login = async (req, res) => {
  // viene del middleware validarCredenciales
  const usuario = req.usuario;

  console.log('Login request received, usuario desde middleware:', usuario?.email);

  if (!usuario) {
    return res.status(401).json({
      error: 'No se recibieron credenciales válidas desde el middleware.',
    });
  }

  try {
    const accessToken = jwt.sign(
      {
        userId: usuario.id,
        email: usuario.email,
        rol_id: usuario.rol_id,
        rol_nombre: usuario.rol_nombre,
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: usuario.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    const estadoSesionActivaId = 1;
    await pool.query(
      `
      INSERT INTO sesiones (usuario_id, access_token, refresh_token, estado_id)
      VALUES ($1, $2, $3, $4)
      `,
      [usuario.id, accessToken, refreshToken, estadoSesionActivaId]
    );

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: usuario.id,
        email: usuario.email,
        rol_id: usuario.rol_id,
        rol_nombre: usuario.rol_nombre,
      },
    });

  } catch (err) {
    console.error('Error en login:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
module.exports = { login };
