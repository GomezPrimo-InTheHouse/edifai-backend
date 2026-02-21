// controllers/usuario.controller.js
const bcrypt = require("bcryptjs");
const pool = require("../../connection/db.js"); // 🔁 mismo path que en trabajador.controller.js

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
      ORDER BY u.id ASC;
    `;

    const { rows } = await pool.query(query);

    return res.json({ ok: true, data: rows });
  } catch (err) {
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
 * POST /api/usuarios
 */
const createUsuario = async (req, res) => {
  const { nombre, email, password, rol_id, estado_id } = req.body;

  if (!email || !password || !rol_id) {
    return res.status(400).json({
      ok: false,
      message: "Los campos email, password y rol_id son obligatorios.",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO usuarios (
        nombre, email, password_hash, rol_id, estado_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, now(), now())
      RETURNING id, nombre, email, rol_id, estado_id, created_at, updated_at;
    `;

    const values = [
      nombre || null,
      email,
      passwordHash,
      rol_id,
      estado_id || null,
    ];

    const { rows } = await pool.query(query, values);

    return res.status(201).json({
      ok: true,
      message: "Usuario creado correctamente.",
      data: rows[0],
    });
  } catch (err) {
    return handlePgError(err, res);
  }
};

/**
 * PUT /api/usuarios/:id
 */
const updateUsuario = async (req, res) => {
  const { id } = req.params;
  const { nombre, email, rol_id, estado_id } = req.body;

  try {
    const query = `
      UPDATE usuarios
      SET
        nombre     = COALESCE($1, nombre),
        email      = COALESCE($2, email),
        rol_id     = COALESCE($3, rol_id),
        estado_id  = COALESCE($4, estado_id),
        updated_at = now()
      WHERE id = $5
      RETURNING id, nombre, email, rol_id, estado_id, created_at, updated_at;
    `;

    const values = [
      nombre || null,
      email || null,
      rol_id || null,
      estado_id || null,
      id,
    ];

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Usuario no encontrado." });
    }

    return res.json({
      ok: true,
      message: "Usuario actualizado correctamente.",
      data: rows[0],
    });
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
  const { id } = req.params;

  try {
    const query = `DELETE FROM usuarios WHERE id = $1 RETURNING id;`;
    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Usuario no encontrado." });
    }

    return res.json({
      ok: true,
      message: "Usuario eliminado correctamente.",
    });
  } catch (err) {
    return handlePgError(err, res);
  }
};

module.exports = {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  updateUsuarioPassword,
  deleteUsuario,
};
