// presupuestos.controller.js - CRUD presupuestos + cambio de estado
// TODO: Implementar controladores CRUD para presupuestos y cambio de estado
const pool = require('../../connection/db.js');

const getAllPresupuestos = async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM presupuestos ORDER BY created_at DESC`);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const getPresupuestoById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`SELECT * FROM presupuestos WHERE id = $1`, [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Presupuesto no encontrado' });
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const createPresupuesto = async (req, res) => {
  const { nombre, descripcion, labor_id, obra_id, estado_id, costo_mano_obra } = req.body;
  try {
    const costoManoObra = Number(costo_mano_obra ?? 0);
    const result = await pool.query(
      `INSERT INTO presupuestos (nombre, descripcion, labor_id, obra_id, estado_id, total_estimado, costo_mano_obra)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nombre, descripcion, labor_id ?? null, obra_id ?? null, estado_id, costoManoObra, costoManoObra]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al crear presupuesto:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const updatePresupuesto = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, estado_id, costo_mano_obra } = req.body;
  try {
    // Recalcula total = materiales + mano de obra
    const result = await pool.query(
      `UPDATE presupuestos SET 
        nombre=$1, descripcion=$2, estado_id=$3, costo_mano_obra=$4,
        total_estimado = (
          SELECT COALESCE(SUM(cantidad * precio_unitario), 0) 
          FROM presupuesto_materiales WHERE presupuesto_id = $5
        ) + $4,
        updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [nombre, descripcion, estado_id, costo_mano_obra ?? 0, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Presupuesto no encontrado' });
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error DETALLADO al actualizar presupuesto:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const deletePresupuesto = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verifica si el presupuesto estaba confirmado
    const presupuesto = await client.query(`SELECT * FROM presupuestos WHERE id = $1`, [id]);
    if (presupuesto.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Presupuesto no encontrado.' });

    const estadoConfirmado = await client.query(
      `SELECT id FROM estados WHERE nombre = 'Confirmado' LIMIT 1`
    );
    const estadoConfirmadoId = estadoConfirmado.rows[0]?.id;
    const estabaConfirmado = presupuesto.rows[0].estado_id === estadoConfirmadoId;

    if (estabaConfirmado) {
      // Devuelve stock de cada material
      const materiales = await client.query(
        `SELECT * FROM presupuesto_materiales WHERE presupuesto_id = $1`, [id]
      );
      for (const pm of materiales.rows) {
        await client.query(
          `UPDATE materiales SET stock_actual = stock_actual + $1, updated_at = NOW() WHERE id = $2`,
          [pm.cantidad, pm.material_id]
        );
      }
    }

    await client.query(`DELETE FROM presupuesto_materiales WHERE presupuesto_id = $1`, [id]);
    await client.query(`DELETE FROM presupuestos WHERE id = $1`, [id]);

    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Presupuesto eliminado.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar presupuesto:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

const cambiarEstadoPresupuesto = async (req, res) => {
  const { id } = req.params;
  const { estado_id } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verifica que el presupuesto exista
    const presupuesto = await client.query(`SELECT * FROM presupuestos WHERE id = $1`, [id]);
    if (presupuesto.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Presupuesto no encontrado' });

    // Obtiene el ID del estado "Confirmado"
    const estadoConfirmado = await client.query(
      `SELECT id FROM estados WHERE nombre = 'Confirmado' LIMIT 1`
    );
    const estadoConfirmadoId = estadoConfirmado.rows[0]?.id;
    const presupuestoActual = presupuesto.rows[0];

    const esConfirmacion = estadoConfirmadoId === estado_id;
    const seEstaRevirtiendo = presupuestoActual.estado_id === estadoConfirmadoId && estado_id !== estadoConfirmadoId;

    if (esConfirmacion) {
      // Decrementa stock de cada material del presupuesto
      const materiales = await client.query(
        `SELECT * FROM presupuesto_materiales WHERE presupuesto_id = $1`, [id]
      );
      for (const pm of materiales.rows) {
        await client.query(
          `UPDATE materiales SET stock_actual = stock_actual - $1, updated_at = NOW() WHERE id = $2`,
          [pm.cantidad, pm.material_id]
        );
      }
    }

    if (seEstaRevirtiendo) {
      // Incrementa stock si se revierte un presupuesto confirmado
      const materiales = await client.query(
        `SELECT * FROM presupuesto_materiales WHERE presupuesto_id = $1`, [id]
      );
      for (const pm of materiales.rows) {
        await client.query(
          `UPDATE materiales SET stock_actual = stock_actual + $1, updated_at = NOW() WHERE id = $2`,
          [pm.cantidad, pm.material_id]
        );
      }
    }

    // Actualiza el estado del presupuesto
    await client.query(
      `UPDATE presupuestos SET estado_id = $1, updated_at = NOW() WHERE id = $2`,
      [estado_id, id]
    );

    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Estado actualizado correctamente.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al cambiar estado del presupuesto:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};
module.exports = {
  getAllPresupuestos, getPresupuestoById, createPresupuesto,
  updatePresupuesto, deletePresupuesto, cambiarEstadoPresupuesto,
};