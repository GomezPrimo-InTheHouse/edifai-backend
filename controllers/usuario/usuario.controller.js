// const bcrypt = require("bcryptjs");
// const pool = require("../../connection/db.js");
// const logger = require('../../utils/logger/logger.js');
// const { register: registerAuth } = require('../auth/register.controller.js');
// const { notificar } = require('../../helpers/notificar.js');

// function handlePgError(err, res) {
//   console.error("PG Error en usuario.controller:", err);
//   if (err.code === "23505") {
//     return res.status(400).json({ ok: false, message: "Ya existe un usuario con ese email.", code: "EMAIL_DUPLICADO" });
//   }
//   return res.status(500).json({ ok: false, message: "Error interno en el servicio de usuarios." });
// }

// const getUsuarios = async (req, res) => {
//   try {
//     const { rows } = await pool.query(`
//       SELECT u.id, u.nombre, u.email, u.rol_id, u.estado_id, u.created_at, u.updated_at,
//              r.nombre AS rol_nombre, e.nombre AS estado_nombre
//       FROM usuarios u
//       LEFT JOIN roles r ON u.rol_id = r.id
//       LEFT JOIN estados e ON u.estado_id = e.id
//       WHERE u.estado_id = 1
//       ORDER BY u.id ASC
//     `);
//     return res.json({ ok: true, data: rows });
//   } catch (err) {
//     return handlePgError(err, res);
//   }
// };

// const getUsuarioById = async (req, res) => {
//   const { id } = req.params;
//   try {
//     const { rows } = await pool.query(`
//       SELECT u.id, u.nombre, u.email, u.rol_id, u.estado_id, u.created_at, u.updated_at,
//              r.nombre AS rol_nombre, e.nombre AS estado_nombre
//       FROM usuarios u
//       LEFT JOIN roles r ON u.rol_id = r.id
//       LEFT JOIN estados e ON u.estado_id = e.id
//       WHERE u.id = $1
//     `, [id]);
//     if (rows.length === 0) return res.status(404).json({ ok: false, message: "Usuario no encontrado." });
//     return res.json({ ok: true, data: rows[0] });
//   } catch (err) {
//     return handlePgError(err, res);
//   }
// };

// const createUsuario = async (req, res) => {
//   const { nombre, email, password, rol_id, estado_id, usuario_creador_id } = req.body;

//   if (!email || !password || !rol_id) {
//     return res.status(400).json({ ok: false, message: 'Los campos email, password y rol_id son obligatorios.' });
//   }

//   try {
//     logger.info(`Creando usuario: ${email}`);

//     const mockReq = { body: { nombre, email, password, rol_id, estado_id, usuario_creador_id } };
//     let authResult = null;
//     const mockRes = {
//       status: (code) => ({ json: (data) => { authResult = { status: code, data }; } }),
//       json: (data) => { authResult = { status: 200, data }; },
//     };

//     await registerAuth(mockReq, mockRes);

//     if (!authResult || authResult.status >= 400) {
//       return res.status(authResult?.status || 500).json({
//         ok: false,
//         message: authResult?.data?.error || authResult?.data?.message || 'Error al crear usuario',
//       });
//     }

//     const { user, qrCodeDataURL, message, totp_seed } = authResult.data;
//     logger.info(`Usuario creado correctamente: ${email}`);

//     await notificar({
//       tipo: 'usuario_creado',
//       mensaje: `Usuario "${nombre || email}" fue creado correctamente`,
//       usuario_id: usuario_creador_id || null,
//     });

//     return res.status(201).json({ ok: true, message, data: user, qrCodeDataURL, totp_seed });
//   } catch (err) {
//     logger.error({ err }, `Error al crear usuario: ${email}`);
//     await notificar({ tipo: 'error_sistema', mensaje: `Error al crear usuario "${email}": ${err.message}`, usuario_id: null });
//     return res.status(500).json({ ok: false, message: 'Error interno al crear usuario' });
//   }
// };

// const updateUsuario = async (req, res) => {
//   const { id } = req.params;
//   const { nombre, email, rol_id, estado_id, usuario_modificador_id, password } = req.body;

//   try {
//     let passwordQuery = '';
//     const values = [nombre || null, email || null, rol_id || null, estado_id || null, id];

//     if (password) {
//       const passwordHash = await bcrypt.hash(password, 10);
//       passwordQuery = `, password_hash = $6`;
//       values.splice(4, 0, passwordHash);
//       values[values.length - 1] = id;
//     }

//     const query = `
//       UPDATE usuarios
//       SET nombre = COALESCE($1, nombre), email = COALESCE($2, email),
//           rol_id = COALESCE($3, rol_id), estado_id = COALESCE($4, estado_id)
//           ${passwordQuery}, updated_at = now()
//       WHERE id = $${values.length}
//       RETURNING id, nombre, email, rol_id, estado_id, created_at, updated_at
//     `;

//     const { rows } = await pool.query(query, values);
//     if (rows.length === 0) return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });

//     await notificar({
//       tipo: 'usuario_modificado',
//       mensaje: `Usuario "${rows[0].nombre || email}" fue modificado`,
//       usuario_id: usuario_modificador_id || null,
//     });

//     return res.json({ ok: true, message: 'Usuario actualizado correctamente.', data: rows[0] });
//   } catch (err) {
//     await notificar({ tipo: 'error_sistema', mensaje: `Error al actualizar usuario #${id}: ${err.message}`, usuario_id: null });
//     return handlePgError(err, res);
//   }
// };

// const updateUsuarioPassword = async (req, res) => {
//   const { id } = req.params;
//   const { password } = req.body;

//   if (!password) return res.status(400).json({ ok: false, message: "La nueva contraseña es obligatoria." });

//   try {
//     const passwordHash = await bcrypt.hash(password, 10);
//     const { rows } = await pool.query(
//       `UPDATE usuarios SET password_hash = $1, updated_at = now() WHERE id = $2
//        RETURNING id, nombre, email, rol_id, estado_id, created_at, updated_at`,
//       [passwordHash, id]
//     );
//     if (rows.length === 0) return res.status(404).json({ ok: false, message: "Usuario no encontrado." });

//     await notificar({
//       tipo: 'cambio_password',
//       mensaje: `Contraseña actualizada para el usuario "${rows[0].nombre || rows[0].email}"`,
//       usuario_id: null,
//     });

//     return res.json({ ok: true, message: "Contraseña cambiada correctamente.", data: rows[0] });
//   } catch (err) {
//     return handlePgError(err, res);
//   }
// };

// const deleteUsuario = async (req, res) => {
//   const user_id = parseInt(req.params.id, 10);
//   const estadoInactivoId = 2;

//   if (!user_id) return res.status(400).json({ ok: false, message: 'Falta el id' });

//   try {
//     const userResult = await pool.query(`SELECT id, nombre, email FROM usuarios WHERE id = $1`, [user_id]);
//     if (userResult.rows.length === 0) return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });

//     const { nombre, email } = userResult.rows[0];

//     await pool.query(`UPDATE usuarios SET estado_id = $1, updated_at = NOW() WHERE id = $2`, [estadoInactivoId, user_id]);
//     await pool.query(
//       `UPDATE sesiones SET estado_id = $1, updated_at = NOW() WHERE usuario_id = $2 AND estado_id = 1`,
//       [estadoInactivoId, user_id]
//     );

//     await notificar({
//       tipo: 'baja_usuario',
//       mensaje: `Usuario "${nombre || email}" fue dado de baja`,
//       usuario_id: null,
//     });

//     return res.status(200).json({ ok: true, message: 'Usuario desactivado correctamente' });
//   } catch (error) {
//     console.error('Error al desactivar usuario:', error);
//     await notificar({ tipo: 'error_sistema', mensaje: `Error al dar de baja usuario #${user_id}: ${error.message}`, usuario_id: null });
//     return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
//   }
// };

// const regenerarTotp = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const usuarioResult = await pool.query(
//       `SELECT id, email, nombre FROM usuarios WHERE id = $1 AND estado_id = 1`, [id]
//     );
//     if (usuarioResult.rows.length === 0) return res.status(404).json({ ok: false, message: 'Usuario no encontrado o inactivo' });

//     const usuario = usuarioResult.rows[0];
//     const { generarTotp, generarQRCodeDataURL } = require('../../utils/auth/totp-util.js');
//     const totp = generarTotp(usuario.email);
//     const totp_seed = totp.base32;
//     const qrCodeDataURL = await generarQRCodeDataURL(totp.otpauth_url);

//     await pool.query(`UPDATE usuarios SET totp_seed = $1, updated_at = NOW() WHERE id = $2`, [totp_seed, id]);

//     await notificar({
//       tipo: 'totp_regenerado',
//       mensaje: `TOTP regenerado para "${usuario.nombre || usuario.email}"`,
//       usuario_id: null,
//     });

//     return res.status(200).json({ ok: true, message: 'TOTP regenerado correctamente', qrCodeDataURL, totp_seed });
//   } catch (err) {
//     console.error('Error al regenerar TOTP:', err);
//     await notificar({ tipo: 'error_sistema', mensaje: `Error al regenerar TOTP para usuario #${id}: ${err.message}`, usuario_id: null });
//     return res.status(500).json({ ok: false, message: 'Error interno al regenerar TOTP' });
//   }
// };
// const obtenerPreferencias = async (req, res) => {
//   const { userId } = req.user;
//   try {
//     const result = await pool.query(
//       `SELECT preferencias, onboarding_completado FROM usuarios WHERE id = $1`,
//       [userId]
//     );
//     if (result.rows.length === 0) {
//       return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
//     }
//     return res.json({ success: true, data: result.rows[0] });
//   } catch (err) {
//     console.error('Error en obtenerPreferencias:', err);
//     return res.status(500).json({ success: false, message: 'Error interno' });
//   }
// };

// const guardarPreferencias = async (req, res) => {
//   const { userId } = req.user;
//   const { preferencias, onboarding_completado } = req.body;

//   try {
//     // Merge con preferencias existentes para no pisar keys no enviadas
//     const result = await pool.query(
//       `UPDATE usuarios 
//        SET preferencias = preferencias || $1::jsonb,
//            onboarding_completado = COALESCE($2, onboarding_completado),
//            updated_at = NOW()
//        WHERE id = $3
//        RETURNING preferencias, onboarding_completado`,
//       [JSON.stringify(preferencias ?? {}), onboarding_completado ?? null, userId]
//     );
//     return res.json({ success: true, data: result.rows[0] });
//   } catch (err) {
//     console.error('Error en guardarPreferencias:', err);
//     return res.status(500).json({ success: false, message: 'Error interno' });
//   }
// };



// module.exports = {
//   getUsuarios, getUsuarioById, createUsuario,
//   updateUsuario, updateUsuarioPassword, deleteUsuario, regenerarTotp,
//     obtenerPreferencias,
//   guardarPreferencias,
// };

const bcrypt = require("bcryptjs");
const pool = require("../../connection/db.js");
const logger = require('../../utils/logger/logger.js');
const { register: registerAuth } = require('../auth/register.controller.js');
const { notificar } = require('../../helpers/notificar.js');
const { getFiltro, ROL_ADMIN_PRIVADO, ROLES_ADMIN } = require('../../middlewares/filtrarPorPropietario.js');

function handlePgError(err, res) {
  console.error("PG Error en usuario.controller:", err);
  if (err.code === "23505") {
    return res.status(400).json({ ok: false, message: "Ya existe un usuario con ese email.", code: "EMAIL_DUPLICADO" });
  }
  return res.status(500).json({ ok: false, message: "Error interno en el servicio de usuarios." });
}

const getUsuarios = async (req, res) => {
  try {
    const esAdminPrivado = req.user.rol_id === ROL_ADMIN_PRIVADO;

    let query, params;

    if (esAdminPrivado) {
      // admin_privado solo ve trabajadores (roles 7 y 8) vinculados a sus obras
      query = `
        SELECT u.id, u.nombre, u.email, u.rol_id, u.estado_id, u.created_at, u.updated_at,
               r.nombre AS rol_nombre, e.nombre AS estado_nombre
        FROM usuarios u
        LEFT JOIN roles r ON u.rol_id = r.id
        LEFT JOIN estados e ON u.estado_id = e.id
        WHERE u.estado_id = 1
          AND u.rol_id IN (7, 8)
          AND u.id IN (
            SELECT usuario_id FROM trabajadores
            WHERE propietario_id = $1
          )
        ORDER BY u.id ASC
      `;
      params = [req.user.userId];
    } else {
      query = `
        SELECT u.id, u.nombre, u.email, u.rol_id, u.estado_id, u.created_at, u.updated_at,
               r.nombre AS rol_nombre, e.nombre AS estado_nombre
        FROM usuarios u
        LEFT JOIN roles r ON u.rol_id = r.id
        LEFT JOIN estados e ON u.estado_id = e.id
        WHERE u.estado_id = 1
        ORDER BY u.id ASC
      `;
      params = [];
    }

    const { rows } = await pool.query(query, params);
    return res.json({ ok: true, data: rows });
  } catch (err) {
    return handlePgError(err, res);
  }
};

const getUsuarioById = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.nombre, u.email, u.rol_id, u.estado_id, u.created_at, u.updated_at,
             r.nombre AS rol_nombre, e.nombre AS estado_nombre
      FROM usuarios u
      LEFT JOIN roles r ON u.rol_id = r.id
      LEFT JOIN estados e ON u.estado_id = e.id
      WHERE u.id = $1
    `, [id]);

    if (rows.length === 0)
      return res.status(404).json({ ok: false, message: "Usuario no encontrado." });

    const usuario = rows[0];

    // admin_privado solo puede ver usuarios trabajadores de sus obras
    if (req.user.rol_id === ROL_ADMIN_PRIVADO) {
      const check = await pool.query(
        `SELECT 1 FROM trabajadores WHERE usuario_id = $1 AND propietario_id = $2`,
        [id, req.user.userId]
      );
      if (check.rows.length === 0)
        return res.status(403).json({ ok: false, message: 'Sin permiso sobre este usuario' });
    }

    return res.json({ ok: true, data: usuario });
  } catch (err) {
    return handlePgError(err, res);
  }
};

const createUsuario = async (req, res) => {
  const { nombre, email, password, rol_id, estado_id, usuario_creador_id } = req.body;

  if (!email || !password || !rol_id) {
    return res.status(400).json({ ok: false, message: 'Los campos email, password y rol_id son obligatorios.' });
  }

  // admin_privado no puede crear usuarios
  if (req.user.rol_id === ROL_ADMIN_PRIVADO) {
    return res.status(403).json({ ok: false, message: 'No tenés permisos para crear usuarios.' });
  }

  // Solo rol_id = 1 puede crear admin_privado (rol 9)
  if (rol_id === ROL_ADMIN_PRIVADO && req.user.rol_id !== 1) {
    return res.status(403).json({ ok: false, message: 'Solo el administrador puede crear usuarios admin_privado.' });
  }

  try {
    logger.info(`Creando usuario: ${email}`);

    const mockReq = { body: { nombre, email, password, rol_id, estado_id, usuario_creador_id } };
    let authResult = null;
    const mockRes = {
      status: (code) => ({ json: (data) => { authResult = { status: code, data }; } }),
      json: (data) => { authResult = { status: 200, data }; },
    };

    await registerAuth(mockReq, mockRes);

    if (!authResult || authResult.status >= 400) {
      return res.status(authResult?.status || 500).json({
        ok: false,
        message: authResult?.data?.error || authResult?.data?.message || 'Error al crear usuario',
      });
    }

    const { user, qrCodeDataURL, message, totp_seed } = authResult.data;
    logger.info(`Usuario creado correctamente: ${email}`);

    await notificar({
      tipo: 'usuario_creado',
      mensaje: `Usuario "${nombre || email}" fue creado correctamente`,
      usuario_id: usuario_creador_id || null,
    });

    return res.status(201).json({ ok: true, message, data: user, qrCodeDataURL, totp_seed });
  } catch (err) {
    logger.error({ err }, `Error al crear usuario: ${email}`);
    await notificar({ tipo: 'error_sistema', mensaje: `Error al crear usuario "${email}": ${err.message}`, usuario_id: null });
    return res.status(500).json({ ok: false, message: 'Error interno al crear usuario' });
  }
};

const updateUsuario = async (req, res) => {
  const { id } = req.params;
  const { nombre, email, rol_id, estado_id, usuario_modificador_id, password } = req.body;

  // admin_privado solo puede editar trabajadores de sus obras
  if (req.user.rol_id === ROL_ADMIN_PRIVADO) {
    const check = await pool.query(
      `SELECT 1 FROM trabajadores WHERE usuario_id = $1 AND propietario_id = $2`,
      [id, req.user.userId]
    );
    if (check.rows.length === 0)
      return res.status(403).json({ ok: false, message: 'Sin permiso sobre este usuario' });
  }

  try {
    let passwordQuery = '';
    const values = [nombre || null, email || null, rol_id || null, estado_id || null, id];

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      passwordQuery = `, password_hash = $6`;
      values.splice(4, 0, passwordHash);
      values[values.length - 1] = id;
    }

    const query = `
      UPDATE usuarios
      SET nombre = COALESCE($1, nombre), email = COALESCE($2, email),
          rol_id = COALESCE($3, rol_id), estado_id = COALESCE($4, estado_id)
          ${passwordQuery}, updated_at = now()
      WHERE id = $${values.length}
      RETURNING id, nombre, email, rol_id, estado_id, created_at, updated_at
    `;

    const { rows } = await pool.query(query, values);
    if (rows.length === 0)
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });

    await notificar({
      tipo: 'usuario_modificado',
      mensaje: `Usuario "${rows[0].nombre || email}" fue modificado`,
      usuario_id: usuario_modificador_id || null,
    });

    return res.json({ ok: true, message: 'Usuario actualizado correctamente.', data: rows[0] });
  } catch (err) {
    await notificar({ tipo: 'error_sistema', mensaje: `Error al actualizar usuario #${id}: ${err.message}`, usuario_id: null });
    return handlePgError(err, res);
  }
};

const updateUsuarioPassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password)
    return res.status(400).json({ ok: false, message: "La nueva contraseña es obligatoria." });

  // admin_privado solo puede cambiar password de trabajadores de sus obras
  if (req.user.rol_id === ROL_ADMIN_PRIVADO) {
    const check = await pool.query(
      `SELECT 1 FROM trabajadores WHERE usuario_id = $1 AND propietario_id = $2`,
      [id, req.user.userId]
    );
    if (check.rows.length === 0)
      return res.status(403).json({ ok: false, message: 'Sin permiso sobre este usuario' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `UPDATE usuarios SET password_hash = $1, updated_at = now() WHERE id = $2
       RETURNING id, nombre, email, rol_id, estado_id, created_at, updated_at`,
      [passwordHash, id]
    );
    if (rows.length === 0)
      return res.status(404).json({ ok: false, message: "Usuario no encontrado." });

    await notificar({
      tipo: 'cambio_password',
      mensaje: `Contraseña actualizada para el usuario "${rows[0].nombre || rows[0].email}"`,
      usuario_id: null,
    });

    return res.json({ ok: true, message: "Contraseña cambiada correctamente.", data: rows[0] });
  } catch (err) {
    return handlePgError(err, res);
  }
};

const deleteUsuario = async (req, res) => {
  const user_id = parseInt(req.params.id, 10);
  const estadoInactivoId = 2;

  if (!user_id)
    return res.status(400).json({ ok: false, message: 'Falta el id' });

  // admin_privado no puede dar de baja usuarios
  if (req.user.rol_id === ROL_ADMIN_PRIVADO)
    return res.status(403).json({ ok: false, message: 'Sin permisos para esta acción' });

  try {
    const userResult = await pool.query(`SELECT id, nombre, email FROM usuarios WHERE id = $1`, [user_id]);
    if (userResult.rows.length === 0)
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });

    const { nombre, email } = userResult.rows[0];

    await pool.query(`UPDATE usuarios SET estado_id = $1, updated_at = NOW() WHERE id = $2`, [estadoInactivoId, user_id]);
    await pool.query(
      `UPDATE sesiones SET estado_id = $1, updated_at = NOW() WHERE usuario_id = $2 AND estado_id = 1`,
      [estadoInactivoId, user_id]
    );

    await notificar({
      tipo: 'baja_usuario',
      mensaje: `Usuario "${nombre || email}" fue dado de baja`,
      usuario_id: null,
    });

    return res.status(200).json({ ok: true, message: 'Usuario desactivado correctamente' });
  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    await notificar({ tipo: 'error_sistema', mensaje: `Error al dar de baja usuario #${user_id}: ${error.message}`, usuario_id: null });
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

const regenerarTotp = async (req, res) => {
  const { id } = req.params;

  // admin_privado solo puede regenerar TOTP de trabajadores de sus obras
  if (req.user.rol_id === ROL_ADMIN_PRIVADO) {
    const check = await pool.query(
      `SELECT 1 FROM trabajadores WHERE usuario_id = $1 AND propietario_id = $2`,
      [id, req.user.userId]
    );
    if (check.rows.length === 0)
      return res.status(403).json({ ok: false, message: 'Sin permiso sobre este usuario' });
  }

  try {
    const usuarioResult = await pool.query(
      `SELECT id, email, nombre FROM usuarios WHERE id = $1 AND estado_id = 1`, [id]
    );
    if (usuarioResult.rows.length === 0)
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado o inactivo' });

    const usuario = usuarioResult.rows[0];
    const { generarTotp, generarQRCodeDataURL } = require('../../utils/auth/totp-util.js');
    const totp = generarTotp(usuario.email);
    const totp_seed = totp.base32;
    const qrCodeDataURL = await generarQRCodeDataURL(totp.otpauth_url);

    await pool.query(`UPDATE usuarios SET totp_seed = $1, updated_at = NOW() WHERE id = $2`, [totp_seed, id]);

    await notificar({
      tipo: 'totp_regenerado',
      mensaje: `TOTP regenerado para "${usuario.nombre || usuario.email}"`,
      usuario_id: null,
    });

    return res.status(200).json({ ok: true, message: 'TOTP regenerado correctamente', qrCodeDataURL, totp_seed });
  } catch (err) {
    console.error('Error al regenerar TOTP:', err);
    await notificar({ tipo: 'error_sistema', mensaje: `Error al regenerar TOTP para usuario #${id}: ${err.message}`, usuario_id: null });
    return res.status(500).json({ ok: false, message: 'Error interno al regenerar TOTP' });
  }
};

const obtenerPreferencias = async (req, res) => {
  const { userId } = req.user;
  try {
    const result = await pool.query(
      `SELECT preferencias, onboarding_completado FROM usuarios WHERE id = $1`, [userId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error en obtenerPreferencias:', err);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
};

const guardarPreferencias = async (req, res) => {
  const { userId } = req.user;
  const { preferencias, onboarding_completado } = req.body;

  try {
    const result = await pool.query(
      `UPDATE usuarios 
       SET preferencias = preferencias || $1::jsonb,
           onboarding_completado = COALESCE($2, onboarding_completado),
           updated_at = NOW()
       WHERE id = $3
       RETURNING preferencias, onboarding_completado`,
      [JSON.stringify(preferencias ?? {}), onboarding_completado ?? null, userId]
    );
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error en guardarPreferencias:', err);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
};

module.exports = {
  getUsuarios, getUsuarioById, createUsuario,
  updateUsuario, updateUsuarioPassword, deleteUsuario, regenerarTotp,
  obtenerPreferencias, guardarPreferencias,
};