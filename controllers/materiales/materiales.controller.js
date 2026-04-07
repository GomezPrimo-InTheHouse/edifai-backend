// materiales.controller.js - CRUD materiales + ajuste masivo de precios
// TODO: Implementar controladores CRUD para materiales y ajuste masivo de precios
const pool  = require('../../connection/db.js');

// Obtiene todos los materiales
const getAllMateriales = async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM materiales ORDER BY nombre ASC`);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al obtener materiales:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Obtiene un material por ID
const getMaterialById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`SELECT * FROM materiales WHERE id = $1`, [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Material no encontrado' });
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Crea un nuevo material
const createMaterial = async (req, res) => {
  const {
    nombre, descripcion, tipo_material_id, unidad,
    stock_actual, precio_unitario, porcentaje_aumento_mensual,
    estado_id, imagen_url,
  } = req.body;

  if (!nombre || !unidad || stock_actual == null || precio_unitario == null || !estado_id) {
    return res.status(400).json({ success: false, message: 'Faltan campos obligatorios: nombre, unidad, stock_actual, precio_unitario, estado_id' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO materiales (nombre, descripcion, tipo_material_id, unidad, stock_actual, precio_unitario, porcentaje_aumento_mensual, estado_id, imagen_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [nombre, descripcion, tipo_material_id, unidad, stock_actual, precio_unitario, porcentaje_aumento_mensual, estado_id, imagen_url]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
      console.error('Error DETALLADO al crear material:', error.message, error.stack);

    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Actualiza un material
const updateMaterial = async (req, res) => {
  const { id } = req.params;
  const {
    nombre, descripcion, tipo_material_id, unidad,
    stock_actual, precio_unitario, porcentaje_aumento_mensual,
    estado_id, imagen_url,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE materiales SET nombre=$1, descripcion=$2, tipo_material_id=$3, unidad=$4,
       stock_actual=$5, precio_unitario=$6, porcentaje_aumento_mensual=$7,
       estado_id=$8, imagen_url=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [nombre, descripcion, tipo_material_id, unidad, stock_actual, precio_unitario, porcentaje_aumento_mensual, estado_id, imagen_url, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Material no encontrado' });
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Elimina un material — verifica que no esté en presupuestos activos
const deleteMaterial = async (req, res) => {
  const { id } = req.params;
  try {
    const enUso = await pool.query(
      `SELECT pm.id FROM presupuesto_materiales pm
       JOIN presupuestos p ON pm.presupuesto_id = p.id
       WHERE pm.material_id = $1 AND p.estado_id != (SELECT id FROM estados WHERE nombre = 'Confirmado' LIMIT 1)`,
      [id]
    );
    if (enUso.rows.length > 0)
      return res.status(400).json({ success: false, message: 'No se puede eliminar: el material está en presupuestos activos.' });

    await pool.query(`DELETE FROM materiales WHERE id = $1`, [id]);
    res.status(200).json({ success: true, message: 'Material eliminado correctamente.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Ajuste masivo de precios — aplica un porcentaje a todos o a un tipo específico
// Registra el historial y recalcula presupuestos NO confirmados
const ajustePreciosMasivo = async (req, res) => {
  const { porcentaje, tipo_material_id, motivo, usuario_id } = req.body;

  if (!porcentaje)
    return res.status(400).json({ success: false, message: 'El porcentaje es obligatorio.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtiene materiales a ajustar
    const query = tipo_material_id
      ? `SELECT * FROM materiales WHERE tipo_material_id = $1`
      : `SELECT * FROM materiales`;
    const materiales = await client.query(query, tipo_material_id ? [tipo_material_id] : []);

    for (const material of materiales.rows) {
      const precioAnterior = parseFloat(material.precio_unitario);
      const precioNuevo = +(precioAnterior * (1 + porcentaje / 100)).toFixed(2);

      // Actualiza precio del material
      await client.query(
        `UPDATE materiales SET precio_unitario = $1, updated_at = NOW() WHERE id = $2`,
        [precioNuevo, material.id]
      );

      // Registra en historial_incremento_material
      await client.query(
        `INSERT INTO historial_incremento_material (material_id, precio_anterior, precio_nuevo, porcentaje_aplicado, motivo, usuario_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [material.id, precioAnterior, precioNuevo, porcentaje, motivo ?? null, usuario_id ?? null]
      );

      // Recalcula presupuestos NO confirmados que usen este material
      const presupuestosActivos = await client.query(
        `SELECT pm.id, pm.presupuesto_id, pm.cantidad, pm.precio_unitario
         FROM presupuesto_materiales pm
         JOIN presupuestos p ON pm.presupuesto_id = p.id
         WHERE pm.material_id = $1
         AND p.estado_id != (SELECT id FROM estados WHERE nombre = 'Confirmado' LIMIT 1)`,
        [material.id]
      );

      for (const pm of presupuestosActivos.rows) {
        const diferencia = +(
          (precioNuevo - parseFloat(pm.precio_unitario)) * parseFloat(pm.cantidad)
        ).toFixed(2);

        // Actualiza precio en presupuesto_materiales
        await client.query(
          `UPDATE presupuesto_materiales SET precio_unitario = $1 WHERE id = $2`,
          [precioNuevo, pm.id]
        );

        // Recalcula total del presupuesto
        await client.query(
          `UPDATE presupuestos SET total_estimado = (
            SELECT SUM(cantidad * precio_unitario) FROM presupuesto_materiales WHERE presupuesto_id = $1
          ), updated_at = NOW() WHERE id = $1`,
          [pm.presupuesto_id]
        );

        // Registra en historial_incremento_presupuesto
        await client.query(
          `INSERT INTO historial_incremento_presupuesto (presupuesto_id, material_id, precio_anterior, precio_nuevo, cantidad, diferencia_total)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [pm.presupuesto_id, material.id, pm.precio_unitario, precioNuevo, pm.cantidad, diferencia]
        );
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ success: true, message: `Precios ajustados correctamente en ${materiales.rows.length} material(es).` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en ajuste masivo:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

const getEstadisticasMateriales = async (req, res) => {
  try {
    // Materiales más utilizados en presupuestos
    const masUtilizados = await pool.query(`
      SELECT m.id, m.nombre, m.unidad,
             COUNT(pm.id) as veces_usado,
             SUM(pm.cantidad) as cantidad_total
      FROM materiales m
      JOIN presupuesto_materiales pm ON m.id = pm.material_id
      GROUP BY m.id, m.nombre, m.unidad
      ORDER BY veces_usado DESC
      LIMIT 5
    `);

    // Top 5 materiales con mayor incremento de precio
    const masAumentaron = await pool.query(`
      SELECT m.id, m.nombre, m.precio_unitario,
             MIN(h.precio_anterior) as precio_inicial,
             MAX(h.precio_nuevo) as precio_actual,
             ROUND(((MAX(h.precio_nuevo) - MIN(h.precio_anterior)) / NULLIF(MIN(h.precio_anterior), 0)) * 100, 2) as porcentaje_aumento
      FROM materiales m
      JOIN historial_incremento_material h ON m.id = h.material_id
      GROUP BY m.id, m.nombre, m.precio_unitario
      ORDER BY porcentaje_aumento DESC
      LIMIT 5
    `);

    // Top 5 con más stock y top 5 con menos stock
    const masStock = await pool.query(`
      SELECT id, nombre, unidad, stock_actual
      FROM materiales
      ORDER BY stock_actual DESC
      LIMIT 5
    `);

    const menosStock = await pool.query(`
      SELECT id, nombre, unidad, stock_actual
      FROM materiales
      ORDER BY stock_actual ASC
      LIMIT 5
    `);

    res.status(200).json({
      success: true,
      data: {
        mas_utilizados: masUtilizados.rows,
        mas_aumentaron: masAumentaron.rows,
        mas_stock: masStock.rows,
        menos_stock: menosStock.rows,
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};



module.exports = {
  getAllMateriales, getMaterialById, createMaterial,
  updateMaterial, deleteMaterial, ajustePreciosMasivo,
  getEstadisticasMateriales,
};