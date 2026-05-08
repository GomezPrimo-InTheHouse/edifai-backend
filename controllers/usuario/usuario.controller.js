// controllers/usuario.controller.js
const bcrypt = require("bcryptjs");
const pool = require("../../connection/db.js"); 
const axios = require('axios');

const MS_AUTH_URL =  'http://localhost:7001';

  const logger = require('../../utils/logger/logger.js');

const {notificar} = require('../../src/helpers/notificar.js');

//error handler para errores de PostgreSQL, en este caso : email duplicado (código 23505)
function handlePgError(err, res) {
  console.error("PG Error en usuario.controller:", err);

  if (err.code === "23505") {
    return res.status(400).json({
      ok: false,
      message: "Ya existe un usuario con ese email.",
      code: "EMAIL_DUPLICADO",
    });
  }

  return res.status(500).json({
    ok: false,
    message: "Error interno en el servicio de usuarios.",
  });
}

/**
 * GET /api/usuarios
 */
const getUsuarios = async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.nombre,
        u.email,
        u.rol_id,
        u.estado_id,
        u.created_at,
        u.updated_at,
        r.nombre AS rol_nombre,
        e.nombre AS estado_nombre
      FROM usuarios u
      LEFT JOIN roles r ON u.rol_id = r.id
      LEFT JOIN estados e ON u.estado_id = e.id
      WHERE u.estado_id = 1
      ORDER BY u.id ASC;
    `;

    const { rows } = await pool.query(query);
    return res.json({ ok: true, data: rows });
  } catch (err) {
    return handlePgError(err, res);
  }
};



/**
 * POST /api/usuarios/
 */
const createUsuario = async (req, res) => {
  const { nombre, email, password, rol_id, estado_id, usuario_creador_id } = req.body;

  if (!email || !password || !rol_id) {
    return res.status(400).json({
      ok: false,
      message: 'Los campos email, password y rol_id son obligatorios.',
    });
  }

  try {
    logger.info(`Creando usuario: ${email}`);

    const authResponse = await axios.post(`${MS_AUTH_URL}/auth/register`, {
      nombre,
      email,
      password,
      rol_id,
      estado_id,
      usuario_creador_id,
    });

    // ✅ totp_seed extraído junto con el resto
    const { user, qrCodeDataURL, message, totp_seed } = authResponse.data;

    logger.info(`Usuario creado correctamente: ${email}`);

    await notificar({
      tipo: 'usuario_creado',
      mensaje: `Usuario "${email}" creado correctamente`,
      usuario_id: usuario_creador_id || null,
    });

    return res.status(201).json({
      ok: true,
      message,
      data: user,
      qrCodeDataURL,
      totp_seed,    // ✅ ahora se incluye en la respuesta
    });

  } catch (err) {
    logger.error({ err }, `Error al crear usuario: ${email}`);

    notificar({
      tipo: 'error_sistema',
      mensaje: `Error al crear usuario "${email}": ${err.message}`,
      usuario_id: null,
    });

    if (err.response?.data) {
      return res.status(err.response.status || 400).json({
        ok: false,
        message: err.response.data.error || err.response.data.message || 'Error al crear usuario',
      });
    }

    return res.status(500).json({
      ok: false,
      message: 'Error interno al crear usuario',
    });
  }
};


/**
 * PUT /api/usuarios/:id
 */
const updateUsuario = async (req, res) => {
  const { id } = req.params;
  const { nombre, email, rol_id, estado_id, usuario_modificador_id, password } = req.body;

  try {
    // Si viene password, actualizarla también
    let passwordQuery = '';
    const values = [
      nombre || null,
      email  || null,
      rol_id || null,
      estado_id || null,
      id,
    ];

    if (password) {
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);
      passwordQuery = `, password_hash = $6`;
      values.splice(4, 0, passwordHash); // insertar antes del id
      values[values.length - 1] = id;    // asegurar que id queda al final
    }

    const query = `
      UPDATE usuarios
      SET
        nombre    = COALESCE($1, nombre),
        email     = COALESCE($2, email),
        rol_id    = COALESCE($3, rol_id),
        estado_id = COALESCE($4, estado_id)
        ${passwordQuery},
        updated_at = now()
      WHERE id = $${values.length}
      RETURNING id, nombre, email, rol_id, estado_id, created_at, updated_at;
    `;

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    await notificar({
      tipo: 'usuario_modificado',
      mensaje: `Usuario #${id} fue modificado`,
      usuario_id: usuario_modificador_id || null,
    });

    return res.json({ ok: true, message: 'Usuario actualizado correctamente.', data: rows[0] });
  } catch (err) {
    notificar({
      tipo: 'error_sistema',
      mensaje: `Error al actualizar usuario #${id}: ${err.message}`,
      usuario_id: null,
    });
    return handlePgError(err, res);
  }
};

/**
 * GET /api/usuarios/:id
 */
const getUsuarioById = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT 
        u.id,
        u.nombre,
        u.email,
        u.rol_id,
        u.estado_id,
        u.created_at,
        u.updated_at,
        r.nombre AS rol_nombre,
        e.nombre AS estado_nombre
      FROM usuarios u
      LEFT JOIN roles r ON u.rol_id = r.id
      LEFT JOIN estados e ON u.estado_id = e.id
      WHERE u.id = $1;
    `;

    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Usuario no encontrado." });
    }

    return res.json({ ok: true, data: rows[0] });
  } catch (err) {
    return handlePgError(err, res);
  }
};
/**
 * PATCH /api/usuarios/:id/password
 */
const updateUsuarioPassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      ok: false,
      message: "La nueva contraseña es obligatoria.",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const query = `
      UPDATE usuarios
      SET password_hash = $1, updated_at = now()
      WHERE id = $2
      RETURNING id, nombre, email, rol_id, estado_id, created_at, updated_at;
    `;

    const { rows } = await pool.query(query, [passwordHash, id]);

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Usuario no encontrado." });
    }

    return res.json({
      ok: true,
      message: "Contraseña cambiada correctamente.",
      data: rows[0],
    });
  } catch (err) {
    return handlePgError(err, res);
  }
};

/**
 * DELETE /api/usuarios/:id
 */
 const deleteUsuario = async (req, res) => {
    const user_id = parseInt(req.params.id, 10);
    const estadoInactivoId = 2;

    if (!user_id) {
    return res.status(400).json({ ok: false, message: 'Falta el id' });
    }

    try {
    const userResult = await pool.query(
      `SELECT id FROM usuarios WHERE id = $1`,
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });
    }

    // Desactivar usuario (nunca borrar físicamente)
    await pool.query(
      `UPDATE usuarios SET estado_id = $1, updated_at = NOW() WHERE id = $2`,
      [estadoInactivoId, user_id]
    );

    // Desactivar todas sus sesiones activas
    await pool.query(
      `UPDATE sesiones SET estado_id = $1, updated_at = NOW()
        WHERE usuario_id = $2 AND estado_id = 1`,
      [estadoInactivoId, user_id]
    );

    await notificar({
      tipo: 'baja_usuario',
      mensaje: `Usuario #${user_id} fue dado de baja`,
      usuario_id: null,
    });

    return res.status(200).json({
      ok: true,
      message: 'Usuario desactivado correctamente',
    });

    } catch (error) {
    console.error('Error al desactivar usuario:', error);
    notificar({
      tipo: 'error_sistema',
      mensaje: `Error al dar de baja usuario #${user_id}: ${error.message}`,
      usuario_id: null,
    });
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
    }
};


const regenerarTotp = async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar que el usuario existe
    const usuarioResult = await pool.query(
      `SELECT id, email FROM usuarios WHERE id = $1 AND estado_id = 1`,
      [id]
    );

    if (usuarioResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Usuario no encontrado o inactivo',
      });
    }

    const usuario = usuarioResult.rows[0];

    // Generar nuevo TOTP
    const { generarTotp, generarQRCodeDataURL } = require('../../utils/auth/totp-util.js');
    const totp         = generarTotp(usuario.email);
    const totp_seed    = totp.base32;
    const otpauth_url  = totp.otpauth_url;
    const qrCodeDataURL = await generarQRCodeDataURL(otpauth_url);

    // Actualizar el seed en la DB
    await pool.query(
      `UPDATE usuarios SET totp_seed = $1, updated_at = NOW() WHERE id = $2`,
      [totp_seed, id]
    );

    await notificar({
      tipo: 'totp_regenerado',
      mensaje: `TOTP regenerado para el usuario "${usuario.email}"`,
      usuario_id: null,
    });

    return res.status(200).json({
      ok: true,
      message: 'TOTP regenerado correctamente',
      qrCodeDataURL,
      totp_seed,
    });

  } catch (err) {
    console.error('Error al regenerar TOTP:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error interno al regenerar TOTP',
    });
  }
};

module.exports = {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  updateUsuarioPassword,
  deleteUsuario,
  regenerarTotp,
};
