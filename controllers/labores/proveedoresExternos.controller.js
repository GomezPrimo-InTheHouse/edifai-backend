const pool = require('../../connection/db.js');
const { notificar } = require('../../helpers/notificar.js');
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

// ── PUT /proveedores-externos/:id/vincular-trabajador ────────
const vincularTrabajador = async (req, res) => {
  const { id } = req.params;
  const { trabajador_id, labor_id } = req.body;

  if (!trabajador_id) {
    return res.status(400).json({ success: false, message: 'trabajador_id es obligatorio' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar que el proveedor externo existe
    const proveedorResult = await client.query(
      `SELECT * FROM proveedores_externos WHERE id = $1`, [id]
    );
    if (proveedorResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Proveedor externo no encontrado' });
    }

    // Verificar que el trabajador existe
    const trabajadorResult = await client.query(
      `SELECT id, nombre, apellido FROM trabajadores WHERE id = $1`, [trabajador_id]
    );
    if (trabajadorResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Trabajador no encontrado' });
    }
    const trabajador = trabajadorResult.rows[0];

    // Vincular proveedor externo → trabajador (vinculación permanente)
    await client.query(
      `UPDATE proveedores_externos SET trabajador_id = $1 WHERE id = $2`,
      [trabajador_id, id]
    );

    // Si se especifica labor_id, asignar el trabajador a esa labor también
    if (labor_id) {
      await client.query(
        `UPDATE labores SET trabajador_id = $1, updated_at = NOW() WHERE id = $2`,
        [trabajador_id, labor_id]
      );
    }

    await client.query('COMMIT');

    await notificar({
      tipo: 'proveedor_vinculado',
      mensaje: `Proveedor externo "${proveedorResult.rows[0].nombre}" vinculado con trabajador ${trabajador.nombre} ${trabajador.apellido}`,
      usuario_id: null,
    });

    return res.status(200).json({
      success: true,
      message: 'Proveedor vinculado correctamente',
      data: { trabajador_id, trabajador_nombre: `${trabajador.nombre} ${trabajador.apellido}` },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al vincular proveedor con trabajador:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

module.exports = { listarProveedores, crearProveedor, vincularTrabajador };