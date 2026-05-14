// gastoImprevisto.controller.js
const pool = require('../connection/db.js');

// ─────────────────────────────────────────────────────────────
// CREAR
// ─────────────────────────────────────────────────────────────
const crearGastoImprevisto = async (req, res) => {
  try {
    const {
      obra_id, especialidad_id, descripcion, motivo,
      monto, forma_pago_id, pagado_por_id, pagado_por_nombre,
      deudor_cliente_id, deudor_usuario_id, fecha,
    } = req.body;

    // Campos obligatorios
    const faltantes = [];
    if (!obra_id)         faltantes.push('obra_id');
    if (!especialidad_id) faltantes.push('especialidad_id');
    if (!descripcion)     faltantes.push('descripcion');
    if (!motivo)          faltantes.push('motivo');
    if (!monto)           faltantes.push('monto');
    if (!forma_pago_id)   faltantes.push('forma_pago_id');
    if (!fecha)           faltantes.push('fecha');

    if (faltantes.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios',
        faltantes,
      });
    }

    if (monto <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El monto debe ser mayor a 0',
      });
    }

    // Validar pagado_por
    if (!pagado_por_id && !pagado_por_nombre) {
      return res.status(400).json({
        success: false,
        message: 'Debe especificar pagado_por_id o pagado_por_nombre',
        faltantes: ['pagado_por'],
      });
    }

    // Validar doble deudor
    if (deudor_cliente_id && deudor_usuario_id) {
      return res.status(400).json({
        success: false,
        message: 'No se puede especificar deudor_cliente_id y deudor_usuario_id al mismo tiempo',
      });
    }

    // Resolver pagado_por_nombre → UUID
    let pagador_id = pagado_por_id;

    if (!pagado_por_id && pagado_por_nombre) {
      const nombre = pagado_por_nombre.trim().toLowerCase();

      const [resU, resT] = await Promise.all([
        pool.query(`SELECT id, nombre FROM usuarios    WHERE LOWER(TRIM(nombre)) = $1`, [nombre]),
        pool.query(`SELECT id, nombre FROM trabajadores WHERE LOWER(TRIM(nombre)) = $1`, [nombre]),
      ]);

      const matches = [
        ...resU.rows.map(r => ({ ...r, origen: 'usuario' })),
        ...resT.rows.map(r => ({ ...r, origen: 'trabajador' })),
      ];

      if (matches.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No se encontró ninguna persona con el nombre "${pagado_por_nombre}"`,
        });
      }

      if (matches.length > 1) {
        return res.status(409).json({
          success: false,
          message: `Se encontraron múltiples personas con el nombre "${pagado_por_nombre}". Indicá cuál es.`,
          opciones: matches.map(m => ({ id: m.id, nombre: m.nombre, origen: m.origen })),
        });
      }

      pagador_id = matches[0].id;
    }

    // Validar obra
    const resObra = await pool.query(`SELECT id, cliente_id FROM obras WHERE id = $1`, [obra_id]);
    if (resObra.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'La obra especificada no existe' });
    }
    const obra = resObra.rows[0];

    // Resolver deudor automático
    let deudor_cliente_final = deudor_cliente_id ?? null;
    let deudor_usuario_final = deudor_usuario_id ?? null;
    let deudor_automatico = false;

    if (!deudor_cliente_id && !deudor_usuario_id) {
      if (!obra.cliente_id) {
        return res.status(400).json({
          success: false,
          message: 'La obra no tiene cliente asociado. Debe especificar un deudor manualmente.',
        });
      }
      deudor_cliente_final = obra.cliente_id;
      deudor_automatico = true;
    }

    // Validar FK secundarias
    const resEsp = await pool.query(`SELECT id FROM especialidades WHERE id = $1`, [especialidad_id]);
    if (resEsp.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'La especialidad especificada no existe' });
    }

    const resFP = await pool.query(`SELECT id FROM formas_pago WHERE id = $1`, [forma_pago_id]);
    if (resFP.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'La forma de pago especificada no existe' });
    }

    // Insertar — estado_id 16 = activo/pendiente, siempre fijo al crear
    const result = await pool.query(
      `INSERT INTO gastos_imprevistos (
        obra_id, especialidad_id, descripcion, motivo, monto,
        forma_pago_id, pagado_por_id,
        deudor_cliente_id, deudor_usuario_id,
        estado_id, fecha, deudor_automatico
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        obra_id, especialidad_id, descripcion, motivo, monto,
        forma_pago_id, pagador_id,
        deudor_cliente_final, deudor_usuario_final,
        16, fecha, deudor_automatico,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Gasto imprevisto registrado con éxito',
      data: result.rows[0],
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al registrar el gasto imprevisto', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// OBTENER TODOS (excluye borrados)
// ─────────────────────────────────────────────────────────────
const obtenerGastosImprevistos = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT gi.*,
              o.nombre        AS obra_nombre,
              e.nombre        AS especialidad_nombre,
              fp.nombre       AS forma_pago_nombre,
              est.nombre      AS estado_nombre
       FROM gastos_imprevistos gi
       LEFT JOIN obras          o   ON o.id   = gi.obra_id
       LEFT JOIN especialidades e   ON e.id   = gi.especialidad_id
       LEFT JOIN formas_pago    fp  ON fp.id  = gi.forma_pago_id
       LEFT JOIN estados        est ON est.id = gi.estado_id
       WHERE gi.estado_id != 15
       ORDER BY gi.fecha DESC`
    );

    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener gastos imprevistos', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// OBTENER POR OBRA
// ─────────────────────────────────────────────────────────────
const obtenerGastosPorObra = async (req, res) => {
  try {
    const { obra_id } = req.params;

    const result = await pool.query(
      `SELECT gi.*,
              e.nombre   AS especialidad_nombre,
              fp.nombre  AS forma_pago_nombre,
              est.nombre AS estado_nombre
       FROM gastos_imprevistos gi
       LEFT JOIN especialidades e   ON e.id   = gi.especialidad_id
       LEFT JOIN formas_pago    fp  ON fp.id  = gi.forma_pago_id
       LEFT JOIN estados        est ON est.id = gi.estado_id
       WHERE gi.obra_id = $1 AND gi.estado_id != 15
       ORDER BY gi.fecha DESC`,
      [obra_id]
    );

    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener gastos de la obra', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// OBTENER POR ID
// ─────────────────────────────────────────────────────────────
const obtenerGastoImprevistoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT gi.*,
              o.nombre   AS obra_nombre,
              e.nombre   AS especialidad_nombre,
              fp.nombre  AS forma_pago_nombre,
              est.nombre AS estado_nombre
       FROM gastos_imprevistos gi
       LEFT JOIN obras          o   ON o.id   = gi.obra_id
       LEFT JOIN especialidades e   ON e.id   = gi.especialidad_id
       LEFT JOIN formas_pago    fp  ON fp.id  = gi.forma_pago_id
       LEFT JOIN estados        est ON est.id = gi.estado_id
       WHERE gi.id = $1 AND gi.estado_id != 15`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Gasto imprevisto no encontrado' });
    }

    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener el gasto imprevisto', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// ACTUALIZAR ESTADO — solo Admin (rol_id = 1)
// ─────────────────────────────────────────────────────────────
const actualizarEstadoGasto = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado_id } = req.body;

    // Verificar rol admin desde JWT
    if (req.user.rol_id !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Solo el administrador puede cambiar el estado de un gasto imprevisto',
      });
    }

    if (!estado_id) {
      return res.status(400).json({ success: false, message: 'Debe especificar estado_id', faltantes: ['estado_id'] });
    }

    // Validar que el estado exista y sea del ámbito correcto
    const resEstado = await pool.query(
      `SELECT id FROM estados WHERE id = $1 AND ambito = 'gastos imprevistos'`,
      [estado_id]
    );
    if (resEstado.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'El estado especificado no existe o no corresponde a gastos imprevistos' });
    }

    // Validar que el gasto exista y no esté borrado
    const resGasto = await pool.query(
      `SELECT id FROM gastos_imprevistos WHERE id = $1 AND estado_id != 15`,
      [id]
    );
    if (resGasto.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Gasto imprevisto no encontrado' });
    }

    const result = await pool.query(
      `UPDATE gastos_imprevistos SET estado_id = $1 WHERE id = $2 RETURNING *`,
      [estado_id, id]
    );

    return res.status(200).json({
      success: true,
      message: 'Estado actualizado con éxito',
      data: result.rows[0],
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al actualizar el estado', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// BORRADO LÓGICO — solo Admin (rol_id = 1)
// ─────────────────────────────────────────────────────────────
const eliminarGastoImprevisto = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.rol_id !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Solo el administrador puede eliminar un gasto imprevisto',
      });
    }

    const resGasto = await pool.query(
      `SELECT id FROM gastos_imprevistos WHERE id = $1 AND estado_id != 15`,
      [id]
    );
    if (resGasto.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Gasto imprevisto no encontrado o ya eliminado' });
    }

    await pool.query(
      `UPDATE gastos_imprevistos SET estado_id = 15 WHERE id = $1`,
      [id]
    );

    return res.status(200).json({ success: true, message: 'Gasto imprevisto eliminado correctamente' });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al eliminar el gasto imprevisto', error: error.message });
  }
};

module.exports = {
  crearGastoImprevisto,
  obtenerGastosImprevistos,
  obtenerGastosPorObra,
  obtenerGastoImprevistoPorId,
  actualizarEstadoGasto,
  eliminarGastoImprevisto,
};