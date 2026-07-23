const pool = require('../../connection/db.js');
const getSupabase = require('../../connection/supabase');
const { notificar } = require('../../helpers/notificar.js');
const { getFiltro, ROL_ADMIN_PRIVADO } = require('../../middlewares/filtrarPorPropietario.js');

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

const crearCompra = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      obra_id, sector_id, especialidad_id, descripcion,
      proveedor, monto, fecha, comprobante_url,
      material_id, cantidad,
    } = req.body;

    const faltantes = [];
    if (!obra_id)         faltantes.push('obra_id');
    if (!especialidad_id) faltantes.push('especialidad_id');
    if (!descripcion)     faltantes.push('descripcion');
    if (!monto)           faltantes.push('monto');
    if (!fecha)           faltantes.push('fecha');
    if (material_id && !cantidad) faltantes.push('cantidad');
    if (faltantes.length > 0)
      return res.status(400).json({ success: false, message: 'Faltan campos obligatorios', faltantes });

    if (monto <= 0)
      return res.status(400).json({ success: false, message: 'El monto debe ser mayor a 0' });

    const resObra = await pool.query('SELECT id, nombre, propietario_id FROM obras WHERE id = $1', [obra_id]);
    if (resObra.rows.length === 0)
      return res.status(404).json({ success: false, message: 'La obra especificada no existe' });
    const obra = resObra.rows[0];

    if (req.user.rol_id === ROL_ADMIN_PRIVADO && obra.propietario_id !== req.user.userId)
      return res.status(403).json({ success: false, message: 'Sin permiso sobre esta obra' });

    const resEsp = await pool.query('SELECT id FROM especialidades WHERE id = $1', [especialidad_id]);
    if (resEsp.rows.length === 0)
      return res.status(404).json({ success: false, message: 'La especialidad especificada no existe' });

    if (sector_id) {
      const resSector = await pool.query('SELECT id FROM sectores WHERE id = $1 AND obra_id = $2 AND activo = TRUE', [sector_id, obra_id]);
      if (resSector.rows.length === 0)
        return res.status(404).json({ success: false, message: 'El sector especificado no existe en esta obra' });
    }

    let material = null;
    let precioAnteriorMaterial = null;
    let precioCompraUnitario = null;

    if (material_id) {
      const resMat = await pool.query('SELECT * FROM materiales WHERE id = $1', [material_id]);
      if (resMat.rows.length === 0)
        return res.status(404).json({ success: false, message: 'El material especificado no existe' });

      material = resMat.rows[0];
      if (req.user.rol_id === ROL_ADMIN_PRIVADO && material.propietario_id !== req.user.userId)
        return res.status(403).json({ success: false, message: 'Sin permiso sobre este material' });

      if (cantidad <= 0)
        return res.status(400).json({ success: false, message: 'La cantidad debe ser mayor a 0' });

      precioAnteriorMaterial = parseFloat(material.precio_unitario);
      precioCompraUnitario = +(monto / cantidad).toFixed(2);
    }

    const propietario_id = req.user.rol_id === ROL_ADMIN_PRIVADO ? req.user.userId : null;

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO compras (
        obra_id, sector_id, especialidad_id, descripcion, proveedor,
        monto, fecha, comprobante_url, usuario_id, propietario_id,
        material_id, cantidad
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        obra_id, sector_id ?? null, especialidad_id, descripcion, proveedor ?? null,
        monto, fecha, comprobante_url ?? null, req.user.userId, propietario_id,
        material_id ?? null, cantidad ?? null,
      ]
    );

    if (material_id) {
      const nuevoStock = parseFloat(material.stock_actual) + parseFloat(cantidad);

      await client.query(
        `UPDATE materiales SET stock_actual = $1, precio_unitario = $2, updated_at = NOW() WHERE id = $3`,
        [nuevoStock, precioCompraUnitario, material_id]
      );

      await client.query(
        `INSERT INTO historial_incremento_material (material_id, precio_anterior, precio_nuevo, porcentaje_aplicado, motivo, usuario_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          material_id, precioAnteriorMaterial, precioCompraUnitario,
          precioAnteriorMaterial > 0 ? +(((precioCompraUnitario - precioAnteriorMaterial) / precioAnteriorMaterial) * 100).toFixed(2) : null,
          `Compra registrada en obra "${obra.nombre}"`,
          req.user.userId,
        ]
      );
    }

    await client.query('COMMIT');

    await notificar({
      tipo: 'compra_creada',
      mensaje: `Nueva compra de ${formatMoney(monto)} registrada en "${obra.nombre}"`,
      usuario_id: null,
    });

    return res.status(201).json({ success: true, message: 'Compra registrada con éxito', data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Error al registrar la compra', error: error.message });
  } finally {
    client.release();
  }
};

const obtenerCompras = async (req, res) => {
  try {
    const { where, params } = getFiltro(req);

    const result = await pool.query(
      `SELECT c.*,
              o.nombre  AS obra_nombre,
              e.nombre  AS especialidad_nombre,
              s.tipo    AS sector_tipo,
              s.valor   AS sector_valor,
              u.nombre  AS usuario_nombre,
              m.nombre  AS material_nombre
       FROM compras c
       LEFT JOIN obras          o ON o.id = c.obra_id
       LEFT JOIN especialidades e ON e.id = c.especialidad_id
       LEFT JOIN sectores       s ON s.id = c.sector_id
       LEFT JOIN usuarios       u ON u.id = c.usuario_id
       LEFT JOIN materiales     m ON m.id = c.material_id
       WHERE c.activo = TRUE ${where.replace('AND propietario_id', 'AND c.propietario_id')}
       ORDER BY c.fecha DESC`,
      params
    );

    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener compras', error: error.message });
  }
};

const obtenerComprasPorObra = async (req, res) => {
  try {
    const { obra_id } = req.params;
    const { where, params } = getFiltro(req);

    const result = await pool.query(
      `SELECT c.*,
              e.nombre  AS especialidad_nombre,
              s.tipo    AS sector_tipo,
              s.valor   AS sector_valor,
              u.nombre  AS usuario_nombre,
              m.nombre  AS material_nombre
       FROM compras c
       LEFT JOIN especialidades e ON e.id = c.especialidad_id
       LEFT JOIN sectores       s ON s.id = c.sector_id
       LEFT JOIN usuarios       u ON u.id = c.usuario_id
       LEFT JOIN materiales     m ON m.id = c.material_id
       WHERE c.obra_id = $${params.length + 1} AND c.activo = TRUE
       ${where.replace('AND propietario_id', 'AND c.propietario_id')}
       ORDER BY c.fecha DESC`,
      [...params, obra_id]
    );

    const resTotal = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS total_compras FROM compras WHERE obra_id = $1 AND activo = TRUE`,
      [obra_id]
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
      total_compras: Number(resTotal.rows[0].total_compras),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener compras de la obra', error: error.message });
  }
};

const obtenerCompraPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT c.*,
              o.nombre  AS obra_nombre,
              e.nombre  AS especialidad_nombre,
              s.tipo    AS sector_tipo,
              s.valor   AS sector_valor,
              u.nombre  AS usuario_nombre,
              m.nombre  AS material_nombre
       FROM compras c
       LEFT JOIN obras          o ON o.id = c.obra_id
       LEFT JOIN especialidades e ON e.id = c.especialidad_id
       LEFT JOIN sectores       s ON s.id = c.sector_id
       LEFT JOIN usuarios       u ON u.id = c.usuario_id
       LEFT JOIN materiales     m ON m.id = c.material_id
       WHERE c.id = $1 AND c.activo = TRUE`,
      [id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Compra no encontrada' });

    const compra = result.rows[0];
    if (req.user.rol_id === ROL_ADMIN_PRIVADO && compra.propietario_id !== req.user.userId)
      return res.status(403).json({ success: false, message: 'Sin permiso sobre esta compra' });

    return res.status(200).json({ success: true, data: compra });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener la compra', error: error.message });
  }
};

const actualizarCompra = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      obra_id, sector_id, especialidad_id, descripcion,
      proveedor, monto, fecha, comprobante_url,
    } = req.body;

    const resCompra = await pool.query('SELECT id, obra_id, propietario_id FROM compras WHERE id = $1 AND activo = TRUE', [id]);
    if (resCompra.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Compra no encontrada' });

    const compraActual = resCompra.rows[0];
    if (req.user.rol_id === ROL_ADMIN_PRIVADO && compraActual.propietario_id !== req.user.userId)
      return res.status(403).json({ success: false, message: 'Sin permiso sobre esta compra' });

    const faltantes = [];
    if (!obra_id)         faltantes.push('obra_id');
    if (!especialidad_id) faltantes.push('especialidad_id');
    if (!descripcion)     faltantes.push('descripcion');
    if (!monto)           faltantes.push('monto');
    if (!fecha)           faltantes.push('fecha');
    if (faltantes.length > 0)
      return res.status(400).json({ success: false, message: 'Faltan campos obligatorios', faltantes });

    if (monto <= 0)
      return res.status(400).json({ success: false, message: 'El monto debe ser mayor a 0' });

    const resObra = await pool.query('SELECT id, propietario_id FROM obras WHERE id = $1', [obra_id]);
    if (resObra.rows.length === 0)
      return res.status(404).json({ success: false, message: 'La obra especificada no existe' });

    if (req.user.rol_id === ROL_ADMIN_PRIVADO && resObra.rows[0].propietario_id !== req.user.userId)
      return res.status(403).json({ success: false, message: 'Sin permiso sobre la obra destino' });

    const resEsp = await pool.query('SELECT id FROM especialidades WHERE id = $1', [especialidad_id]);
    if (resEsp.rows.length === 0)
      return res.status(404).json({ success: false, message: 'La especialidad especificada no existe' });

    if (sector_id) {
      const resSector = await pool.query('SELECT id FROM sectores WHERE id = $1 AND obra_id = $2 AND activo = TRUE', [sector_id, obra_id]);
      if (resSector.rows.length === 0)
        return res.status(404).json({ success: false, message: 'El sector especificado no existe en esta obra' });
    }

    const result = await pool.query(
      `UPDATE compras SET
        obra_id         = $1,
        sector_id       = $2,
        especialidad_id = $3,
        descripcion     = $4,
        proveedor       = $5,
        monto           = $6,
        fecha           = $7,
        comprobante_url = $8,
        updated_at      = NOW()
      WHERE id = $9
      RETURNING *`,
      [
        obra_id, sector_id ?? null, especialidad_id, descripcion,
        proveedor ?? null, monto, fecha, comprobante_url ?? null, id,
      ]
    );

    return res.status(200).json({ success: true, message: 'Compra actualizada con éxito', data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al actualizar la compra', error: error.message });
  }
};

const eliminarCompra = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const resCompra = await pool.query(
      'SELECT id, propietario_id, material_id, cantidad FROM compras WHERE id = $1 AND activo = TRUE',
      [id]
    );
    if (resCompra.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Compra no encontrada o ya eliminada' });

    const compra = resCompra.rows[0];
    if (req.user.rol_id === ROL_ADMIN_PRIVADO && compra.propietario_id !== req.user.userId)
      return res.status(403).json({ success: false, message: 'Sin permiso sobre esta compra' });

    await client.query('BEGIN');

    await client.query('UPDATE compras SET activo = FALSE, updated_at = NOW() WHERE id = $1', [id]);

    if (compra.material_id && compra.cantidad) {
      await client.query(
        `UPDATE materiales SET stock_actual = GREATEST(stock_actual - $1, 0), updated_at = NOW() WHERE id = $2`,
        [compra.cantidad, compra.material_id]
      );
    }

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Compra eliminada correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Error al eliminar la compra', error: error.message });
  } finally {
    client.release();
  }
};

const subirComprobante = async (req, res) => {
  const supabase = getSupabase();
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: 'No se recibió ningún archivo' });

    const ext = req.file.originalname.split('.').pop();
    const fileName = `comprobante-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from('comprobantes-compras')
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

    if (error) {
      console.error('Error subiendo comprobante a Supabase:', error);
      return res.status(500).json({ success: false, message: 'Error al subir el comprobante' });
    }

    const { data } = supabase.storage.from('comprobantes-compras').getPublicUrl(fileName);
    return res.status(200).json({ success: true, url: data.publicUrl });
  } catch (err) {
    console.error('Error en subirComprobante:', err);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = {
  crearCompra,
  obtenerCompras,
  obtenerComprasPorObra,
  obtenerCompraPorId,
  actualizarCompra,
  eliminarCompra,
  subirComprobante,
};