const pool = require('../../connection/db.js');
const { getFiltro, ROL_ADMIN_PRIVADO } = require('../../middlewares/filtrarPorPropietario.js');

const getHistorialCompleto = async (req, res) => {
  try {
    const { where, params } = getFiltro(req);

    const result = await pool.query(
      `SELECT h.*, m.nombre as material_nombre
       FROM historial_incremento_material h
       JOIN materiales m ON h.material_id = m.id
       WHERE 1=1 ${where.replace('AND propietario_id', 'AND m.propietario_id')}
       ORDER BY h.created_at DESC`,
      params
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const getHistorialByMaterial = async (req, res) => {
  const { material_id } = req.params;
  try {
    const { where, params } = getFiltro(req);

    const result = await pool.query(
      `SELECT h.*, m.nombre as material_nombre
       FROM historial_incremento_material h
       JOIN materiales m ON h.material_id = m.id
       WHERE h.material_id = $${params.length + 1}
       ${where.replace('AND propietario_id', 'AND m.propietario_id')}
       ORDER BY h.created_at DESC`,
      [...params, material_id]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = { getHistorialCompleto, getHistorialByMaterial };