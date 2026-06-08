const pool = require('../../connection/db.js');
const { notificar } = require('../../helpers/notificar.js');
const { getFiltro, ROL_ADMIN_PRIVADO } = require('../../middlewares/filtrarPorPropietario.js');

const getAllMateriales = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const { where, params } = getFiltro(req);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM materiales WHERE 1=1 ${where}`,
      params
    );

    const total = Number(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    const result = await pool.query(
      `SELECT * FROM materiales WHERE 1=1 ${where} ORDER BY nombre ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        totalPages,
        page,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error al obtener materiales:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const getMaterialById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`SELECT * FROM materiales WHERE id = $1`, [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Material no encontrado' });

    const material = result.rows[0];
    if (req.user.rol_id === ROL_ADMIN_PRIVADO && material.propietario_id !== req.user.userId)
      return res.status(403).json({ success: false, message: 'Sin permiso sobre este material' });

    res.status(200).json({ success: true, data: material });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const createMaterial = async (req, res) => {
  const {
    nombre, descripcion, tipo_material_id, unidad,
    stock_actual, precio_unitario, porcentaje_aumento_mensual,
    estado_id, imagen_url,
  } = req.body;

  const propietario_id = req.user.rol_id === ROL_ADMIN_PRIVADO ? req.user.userId : null;

  if (!nombre || !unidad || stock_actual == null || precio_unitario == null || !estado_id)
    return res.status(400).json({ success: false, message: 'Faltan campos obligatorios: nombre, unidad, stock_actual, precio_unitario, estado_id' });

  try {
    const result = await pool.query(
      `INSERT INTO materiales (nombre, descripcion, tipo_material_id, unidad, stock_actual, precio_unitario, porcentaje_aumento_mensual, estado_id, imagen_url, propietario_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [nombre, descripcion, tipo_material_id, unidad, stock_actual, precio_unitario, porcentaje_aumento_mensual, estado_id, imagen_url, propietario_id]
    );
    await notificar({ tipo: 'material_creado', mensaje: `Material "${nombre}" fue creado`, usuario_id: null });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    await notificar({ tipo: 'error_sistema', mensaje: `Error al crear material "${nombre}": ${error.message}`, usuario_id: null });
    console.error('Error al crear material:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const updateMaterial = async (req, res) => {
  const { id } = req.params;
  const {
    nombre, descripcion, tipo_material_id, unidad,
    stock_actual, precio_unitario, porcentaje_aumento_mensual,
    estado_id, imagen_url,
  } = req.body;

  try {
    const existente = await pool.query(`SELECT propietario_id FROM materiales WHERE id = $1`, [id]);
    if (existente.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Material no encontrado' });

    if (req.user.rol_id === ROL_ADMIN_PRIVADO && existente.rows[0].propietario_id !== req.user.userId)
      return res.status(403).json({ success: false, message: 'Sin permiso sobre este material' });

    const result = await pool.query(
      `UPDATE materiales SET nombre=$1, descripcion=$2, tipo_material_id=$3, unidad=$4,
       stock_actual=$5, precio_unitario=$6, porcentaje_aumento_mensual=$7,
       estado_id=$8, imagen_url=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [nombre, descripcion, tipo_material_id, unidad, stock_actual, precio_unitario, porcentaje_aumento_mensual, estado_id, imagen_url, id]
    );

    await notificar({ tipo: 'material_modificado', mensaje: `Material "${result.rows[0].nombre}" fue modificado`, usuario_id: null });
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    await notificar({ tipo: 'error_sistema', mensaje: `Error al modificar material #${id}: ${error.message}`, usuario_id: null });
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const deleteMaterial = async (req, res) => {
  const { id } = req.params;
  try {
    const existente = await pool.query(`SELECT nombre, propietario_id FROM materiales WHERE id = $1`, [id]);
    if (existente.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Material no encontrado' });

    if (req.user.rol_id === ROL_ADMIN_PRIVADO && existente.rows[0].propietario_id !== req.user.userId)
      return res.status(403).json({ success: false, message: 'Sin permiso sobre este material' });

    const enUso = await pool.query(
      `SELECT pm.id FROM presupuesto_materiales pm
       JOIN presupuestos p ON pm.presupuesto_id = p.id
       WHERE pm.material_id = $1 AND p.estado_id != (SELECT id FROM estados WHERE nombre = 'Confirmado' LIMIT 1)`,
      [id]
    );
    if (enUso.rows.length > 0)
      return res.status(400).json({ success: false, message: 'No se puede eliminar: el material está en presupuestos activos.' });

    const nombreMaterial = existente.rows[0].nombre;
    await pool.query(`DELETE FROM materiales WHERE id = $1`, [id]);
    await notificar({ tipo: 'material_eliminado', mensaje: `Material "${nombreMaterial}" fue eliminado`, usuario_id: null });
    res.status(200).json({ success: true, message: 'Material eliminado correctamente.' });
  } catch (error) {
    await notificar({ tipo: 'error_sistema', mensaje: `Error al eliminar material #${id}: ${error.message}`, usuario_id: null });
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const ajustePreciosMasivo = async (req, res) => {
  const { porcentaje, tipo_material_id, motivo, usuario_id } = req.body;

  if (!porcentaje)
    return res.status(400).json({ success: false, message: 'El porcentaje es obligatorio.' });

  const { where, params } = getFiltro(req);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let query, queryParams;
    if (tipo_material_id) {
      query = `SELECT * FROM materiales WHERE tipo_material_id = $${params.length + 1} ${where}`;
      queryParams = [...params, tipo_material_id];
    } else {
      query = `SELECT * FROM materiales WHERE 1=1 ${where}`;
      queryParams = params;
    }

    const materiales = await client.query(query, queryParams);

    for (const material of materiales.rows) {
      const precioAnterior = parseFloat(material.precio_unitario);
      const precioNuevo = +(precioAnterior * (1 + porcentaje / 100)).toFixed(2);

      await client.query(
        `UPDATE materiales SET precio_unitario = $1, updated_at = NOW() WHERE id = $2`,
        [precioNuevo, material.id]
      );

      await client.query(
        `INSERT INTO historial_incremento_material (material_id, precio_anterior, precio_nuevo, porcentaje_aplicado, motivo, usuario_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [material.id, precioAnterior, precioNuevo, porcentaje, motivo ?? null, usuario_id ?? null]
      );

      const presupuestosActivos = await client.query(
        `SELECT pm.id, pm.presupuesto_id, pm.cantidad, pm.precio_unitario
         FROM presupuesto_materiales pm
         JOIN presupuestos p ON pm.presupuesto_id = p.id
         WHERE pm.material_id = $1
         AND p.estado_id != (SELECT id FROM estados WHERE nombre = 'Confirmado' LIMIT 1)`,
        [material.id]
      );

      for (const pm of presupuestosActivos.rows) {
        const diferencia = +((precioNuevo - parseFloat(pm.precio_unitario)) * parseFloat(pm.cantidad)).toFixed(2);

        await client.query(
          `UPDATE presupuesto_materiales SET precio_unitario = $1 WHERE id = $2`,
          [precioNuevo, pm.id]
        );

        await client.query(
          `UPDATE presupuestos SET total_estimado = (
            SELECT SUM(cantidad * precio_unitario) FROM presupuesto_materiales WHERE presupuesto_id = $1
          ), updated_at = NOW() WHERE id = $1`,
          [pm.presupuesto_id]
        );

        await client.query(
          `INSERT INTO historial_incremento_presupuesto (presupuesto_id, material_id, precio_anterior, precio_nuevo, cantidad, diferencia_total)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [pm.presupuesto_id, material.id, pm.precio_unitario, precioNuevo, pm.cantidad, diferencia]
        );
      }
    }

    await client.query('COMMIT');
    await notificar({
      tipo: 'ajuste_precios',
      mensaje: `Ajuste de precios del ${porcentaje}% aplicado a ${materiales.rows.length} material(es)${motivo ? ` — motivo: ${motivo}` : ''}`,
      usuario_id: null,
    });
    res.status(200).json({ success: true, message: `Precios ajustados correctamente en ${materiales.rows.length} material(es).` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en ajuste masivo:', error);
    await notificar({ tipo: 'error_sistema', mensaje: `Error en ajuste masivo de precios: ${error.message}`, usuario_id: null });
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

const getEstadisticasMateriales = async (req, res) => {
  try {
    const { where, params } = getFiltro(req);

    const masUtilizados = await pool.query(`
      SELECT m.id, m.nombre, m.unidad,
             COUNT(pm.id) as veces_usado,
             SUM(pm.cantidad) as cantidad_total
      FROM materiales m
      JOIN presupuesto_materiales pm ON m.id = pm.material_id
      WHERE 1=1 ${where.replace('AND propietario_id', 'AND m.propietario_id')}
      GROUP BY m.id, m.nombre, m.unidad
      ORDER BY veces_usado DESC
      LIMIT 5
    `, params);

    const masAumentaron = await pool.query(`
      SELECT m.id, m.nombre, m.precio_unitario,
             MIN(h.precio_anterior) as precio_inicial,
             MAX(h.precio_nuevo) as precio_actual,
             ROUND(((MAX(h.precio_nuevo) - MIN(h.precio_anterior)) / NULLIF(MIN(h.precio_anterior), 0)) * 100, 2) as porcentaje_aumento
      FROM materiales m
      JOIN historial_incremento_material h ON m.id = h.material_id
      WHERE 1=1 ${where.replace('AND propietario_id', 'AND m.propietario_id')}
      GROUP BY m.id, m.nombre, m.precio_unitario
      ORDER BY porcentaje_aumento DESC
      LIMIT 5
    `, params);

    const masStock = await pool.query(`
      SELECT id, nombre, unidad, stock_actual
      FROM materiales
      WHERE 1=1 ${where}
      ORDER BY stock_actual DESC
      LIMIT 5
    `, params);

    const menosStock = await pool.query(`
      SELECT id, nombre, unidad, stock_actual
      FROM materiales
      WHERE 1=1 ${where}
      ORDER BY stock_actual ASC
      LIMIT 5
    `, params);

    res.status(200).json({
      success: true,
      data: {
        mas_utilizados: masUtilizados.rows,
        mas_aumentaron: masAumentaron.rows,
        mas_stock:      masStock.rows,
        menos_stock:    menosStock.rows,
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