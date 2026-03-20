// presupuestoMateriales.controller.js - materiales por presupuesto
// TODO: Implementar controladores para materiales por presupuesto
const pool  = require('../../connection/db.js');

const getMaterialesByPresupuesto = async (req, res) => {
  const { presupuesto_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT pm.*, m.nombre as material_nombre, m.unidad
       FROM presupuesto_materiales pm
       JOIN materiales m ON pm.material_id = m.id
       WHERE pm.presupuesto_id = $1`,
      [presupuesto_id]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};



const updateCantidadMaterial = async (req, res) => {
  const { id } = req.params;
  const { cantidad } = req.body;
  try {
    const pm = await pool.query(`SELECT * FROM presupuesto_materiales WHERE id = $1`, [id]);
    if (pm.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Registro no encontrado.' });

    const subtotal = +(cantidad * pm.rows[0].precio_unitario).toFixed(2);
    await pool.query(
      `UPDATE presupuesto_materiales SET cantidad = $1, subtotal = $2 WHERE id = $3`,
      [cantidad, subtotal, id]
    );

    // Recalcula total
    await pool.query(
      `UPDATE presupuestos SET total_estimado = (
        SELECT SUM(cantidad * precio_unitario) FROM presupuesto_materiales WHERE presupuesto_id = $1
      ), updated_at = NOW() WHERE id = $1`,
      [pm.rows[0].presupuesto_id]
    );

    res.status(200).json({ success: true, message: 'Cantidad actualizada.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};



const addMaterialToPresupuesto = async (req, res) => {
  const { presupuesto_id, material_id, cantidad } = req.body;
  if (!presupuesto_id || !material_id || !cantidad)
    return res.status(400).json({ success: false, message: 'Faltan campos obligatorios.' });

  try {
    const material = await pool.query(`SELECT precio_unitario FROM materiales WHERE id = $1`, [material_id]);
    if (material.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Material no encontrado.' });

    const precio_unitario = material.rows[0].precio_unitario;
    const subtotal = +(cantidad * precio_unitario).toFixed(2);

    const result = await pool.query(
      `INSERT INTO presupuesto_materiales (presupuesto_id, material_id, cantidad, precio_unitario, subtotal)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [presupuesto_id, material_id, cantidad, precio_unitario, subtotal]
    );

    await pool.query(
      `UPDATE presupuestos SET 
        total_estimado = (
          SELECT COALESCE(SUM(cantidad * precio_unitario), 0) 
          FROM presupuesto_materiales WHERE presupuesto_id = $1
        ) + COALESCE(costo_mano_obra, 0),
        updated_at = NOW() 
       WHERE id = $1`,
      [presupuesto_id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    // console.error('Error al agregar material:', error.message);
    console.error('Error al agregar material:', error.message, error.stack);

    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const removeMaterialFromPresupuesto = async (req, res) => {
  const { id } = req.params;
  try {
    const pm = await pool.query(`SELECT * FROM presupuesto_materiales WHERE id = $1`, [id]);
    if (pm.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Registro no encontrado.' });

    await pool.query(`DELETE FROM presupuesto_materiales WHERE id = $1`, [id]);

    await pool.query(
      `UPDATE presupuestos SET 
        total_estimado = (
          SELECT COALESCE(SUM(cantidad * precio_unitario), 0) 
          FROM presupuesto_materiales WHERE presupuesto_id = $1
        ) + COALESCE(costo_mano_obra, 0),
        updated_at = NOW() 
       WHERE id = $1`,
      [pm.rows[0].presupuesto_id]
    );

    res.status(200).json({ success: true, message: 'Material removido.' });
  } catch (error) {
    console.error('Error al remover material:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = {
  getMaterialesByPresupuesto, addMaterialToPresupuesto,
  updateCantidadMaterial, removeMaterialFromPresupuesto,
};