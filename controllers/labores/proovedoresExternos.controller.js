const pool = require('../../connection/db.js');
const { ROL_ADMIN_PRIVADO } = require('../../middlewares/filtrarPorPropietario.js');

// ── GET /proveedores-externos ────────────────────────────────
const listarProveedores = async (req, res) => {
  try {
    const propietario_id = req.user.rol_id === ROL_ADMIN_PRIVADO ? req.user.userId : null;

    const result = await pool.query(`
      SELECT * FROM proveedores_externos
      ${propietario_id ? 'WHERE propietario_id = $1' : ''}
      ORDER BY nombre ASC
    `, propietario_id ? [propietario_id] : []);

    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al listar proveedores externos:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// ── POST /proveedores-externos ───────────────────────────────
const crearProveedor = async (req, res) => {
  const { nombre } = req.body;
  try {
    if (!nombre) return res.status(400).json({ success: false, message: 'El campo nombre es obligatorio' });

    const propietario_id = req.user.rol_id === ROL_ADMIN_PRIVADO ? req.user.userId : null;

    const result = await pool.query(`
      INSERT INTO proveedores_externos (nombre, propietario_id)
      VALUES ($1, $2)
      RETURNING *
    `, [nombre, propietario_id]);

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al crear proveedor externo:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = { listarProveedores, crearProveedor };