// tipoMaterial.controller.js - CRUD tipos de material
// TODO: Implementar controladores CRUD para tipos de material
const  pool  = require('../../connection/db.js');

const getAllTiposMaterial = async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM tipos_materiales ORDER BY nombre ASC`);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const createTipoMaterial = async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ success: false, message: 'El nombre es obligatorio.' });
  try {
    const result = await pool.query(
      `INSERT INTO tipos_materiales (nombre) VALUES ($1) RETURNING *`, [nombre]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const deleteTipoMaterial = async (req, res) => {
  const { id } = req.params;
  try {
    const enUso = await pool.query(`SELECT id FROM materiales WHERE tipo_material_id = $1 LIMIT 1`, [id]);
    if (enUso.rows.length > 0)
      return res.status(400).json({ success: false, message: 'No se puede eliminar: hay materiales de este tipo.' });
    await pool.query(`DELETE FROM tipos_materiales WHERE id = $1`, [id]);
    res.status(200).json({ success: true, message: 'Tipo de material eliminado.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = { getAllTiposMaterial, createTipoMaterial, deleteTipoMaterial };