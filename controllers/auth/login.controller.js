// // controllers/login.controller.js (o auth.controller.js, según tu estructura)
// const pool = require('../../connection/db.js');
// const jwt = require('jsonwebtoken');
// // const { verificarTotp } = require('../../utils/auth/totp-util.js');
// const { notificar } = require('../../src/helpers/notificar.js');

// require('dotenv').config();

// const login = async (req, res) => {
//   // viene del middleware validarCredenciales
//   const usuario = req.usuario;

//   console.log('Login request received, usuario desde middleware:', usuario?.email);

//   if (!usuario) {
//     return res.status(401).json({
//       error: 'No se recibieron credenciales válidas desde el middleware.',
//     });
//   }

//   try {
//     const accessToken = jwt.sign(
//       {
//         userId: usuario.id,
//         email: usuario.email,
//         rol_id: usuario.rol_id,
//         rol_nombre: usuario.rol_nombre,
//       },
//       process.env.JWT_SECRET_KEY,
//       { expiresIn: '1h' }
//     );

//     const refreshToken = jwt.sign(
//       { userId: usuario.id },
//       process.env.JWT_REFRESH_SECRET,
//       { expiresIn: '7d' }
//     );

//     const estadoSesionActivaId = 1;
//     await pool.query(
//       `
//       INSERT INTO sesiones (usuario_id, access_token, refresh_token, estado_id)
//       VALUES ($1, $2, $3, $4)
//       `,
//       [usuario.id, accessToken, refreshToken, estadoSesionActivaId]
//     );

//     await notificar({ tipo: 'login', mensaje: `Usuario ${usuario.email} inició sesión`, usuario_id: usuario.id });

//     return res.json({
//       accessToken,
//       refreshToken,
//       user: {
//         id: usuario.id,
//         email: usuario.email,
//         rol_id: usuario.rol_id,
//         rol_nombre: usuario.rol_nombre,
//       },
//     });

//   } catch (err) {
//     notificar({ tipo: 'error_sistema', mensaje: `Error en login: ${err.message}`, usuario_id: null });
//     console.error('Error en login:', err);
//     return res.status(500).json({ error: 'Error interno del servidor' });
//   }

// };
// module.exports = { login };


const pool = require('../../connection/db.js');
const jwt = require('jsonwebtoken');
const { notificar } = require('../../src/helpers/notificar.js');

require('dotenv').config();

const login = async (req, res) => {
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
        userId:    usuario.id,
        email:     usuario.email,
        rol_id:    usuario.rol_id,
        rol_nombre: usuario.rol_nombre,
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '15m' }  // ← 15 minutos
    );

    const refreshToken = jwt.sign(
      { userId: usuario.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }   // ← 7 días sin cambios
    );

    // Guardar sesión activa
    await pool.query(
      `INSERT INTO sesiones (usuario_id, access_token, refresh_token, estado_id)
       VALUES ($1, $2, $3, $4)`,
      [usuario.id, accessToken, refreshToken, 1]
    );

    await notificar({
      tipo: 'login',
      mensaje: `Usuario ${usuario.email} inició sesión`,
      usuario_id: usuario.id,
    });

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id:        usuario.id,
        email:     usuario.email,
        rol_id:    usuario.rol_id,
        rol_nombre: usuario.rol_nombre,
      },
    });

  } catch (err) {
    notificar({
      tipo: 'error_sistema',
      mensaje: `Error en login: ${err.message}`,
      usuario_id: null,
    });
    console.error('Error en login:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { login };