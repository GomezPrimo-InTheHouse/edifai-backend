// historialIncremento.controller.js - historial de incrementos
// TODO: Implementar controladores para historial de incrementos
const  pool  = require('../../connection/db.js');

const getHistorialCompleto = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT h.*, m.nombre as material_nombre
       FROM historial_incremento_material h
       JOIN materiales m ON h.material_id = m.id
       ORDER BY h.created_at DESC`
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const getHistorialByMaterial = async (req, res) => {
  const { material_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM historial_incremento_material WHERE material_id = $1 ORDER BY created_at DESC`,
      [material_id]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = { getHistorialCompleto, getHistorialByMaterial };