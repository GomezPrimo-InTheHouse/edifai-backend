// gastoImprevisto.controller.js
const pool = require('../../connection/db.js');
const getSupabase = require('../../connection/supabase');
const { notificar } = require('../../helpers/notificar.js');

const ROLES_WORKER = [7, 8];

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

// ─────────────────────────────────────────────────────────────
// CREAR
// ─────────────────────────────────────────────────────────────
const crearGastoImprevisto = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      obra_id, especialidad_id, descripcion, motivo,
      monto, pagado_por_id, pagado_por_nombre,
      deudor_cliente_id, deudor_usuario_id, fecha,
      ticket_url, formas_pago,
    } = req.body;

    const faltantes = [];
    if (!obra_id)         faltantes.push('obra_id');
    if (!especialidad_id) faltantes.push('especialidad_id');
    if (!descripcion)     faltantes.push('descripcion');
    if (!monto)           faltantes.push('monto');
    if (!fecha)           faltantes.push('fecha');
    if (!formas_pago || !Array.isArray(formas_pago) || formas_pago.length === 0)
      faltantes.push('formas_pago');
    if (faltantes.length > 0)
      return res.status(400).json({ success: false, message: 'Faltan campos obligatorios', faltantes });

    if (monto <= 0)
      return res.status(400).json({ success: false, message: 'El monto debe ser mayor a 0' });

    const sumaFormasPago = formas_pago.reduce((acc, fp) => acc + Number(fp.monto), 0);
    if (Math.abs(sumaFormasPago - Number(monto)) > 0.01)
      return res.status(400).json({
        success: false,
        message: `Las formas de pago deben sumar el monto total. Suma actual: ${sumaFormasPago}, monto: ${monto}`,
      });

    if (!pagado_por_id && !pagado_por_nombre)
      return res.status(400).json({
        success: false,
        message: 'Debe especificar pagado_por_id o pagado_por_nombre',
        faltantes: ['pagado_por'],
      });

    if (deudor_cliente_id && deudor_usuario_id)
      return res.status(400).json({
        success: false,
        message: 'No se puede especificar deudor_cliente_id y deudor_usuario_id al mismo tiempo',
      });

    // Resolver pagado_por_nombre → id
    let pagador_id = pagado_por_id;
    if (!pagado_por_id && pagado_por_nombre) {
      const nombre = pagado_por_nombre.trim().toLowerCase();
      const [resU, resT] = await Promise.all([
        pool.query(`SELECT id FROM usuarios     WHERE LOWER(TRIM(nombre)) = $1`, [nombre]),
        pool.query(`SELECT id FROM trabajadores WHERE LOWER(TRIM(nombre)) = $1`, [nombre]),
      ]);
      const matches = [...resU.rows, ...resT.rows];
      if (matches.length === 0)
        return res.status(404).json({ success: false, message: `No se encontró ninguna persona con el nombre "${pagado_por_nombre}"` });
      pagador_id = matches[0].id;
    }

    const resObra = await pool.query(`SELECT id, nombre, cliente_id FROM obras WHERE id = $1`, [obra_id]);
    if (resObra.rows.length === 0)
      return res.status(404).json({ success: false, message: 'La obra especificada no existe' });
    const obra = resObra.rows[0];

    let deudor_cliente_final = deudor_cliente_id ?? null;
    let deudor_usuario_final = deudor_usuario_id ?? null;
    let deudor_automatico = false;
    if (!deudor_cliente_id && !deudor_usuario_id && obra.cliente_id) {
      deudor_cliente_final = obra.cliente_id;
      deudor_automatico = true;
    }

    const resEsp = await pool.query(`SELECT id FROM especialidades WHERE id = $1`, [especialidad_id]);
    if (resEsp.rows.length === 0)
      return res.status(404).json({ success: false, message: 'La especialidad especificada no existe' });

    for (const fp of formas_pago) {
      const resFP = await pool.query(`SELECT id FROM formas_pago WHERE id = $1`, [fp.forma_pago_id]);
      if (resFP.rows.length === 0)
        return res.status(404).json({ success: false, message: `La forma de pago ${fp.forma_pago_id} no existe` });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO gastos_imprevistos (
        obra_id, especialidad_id, descripcion, motivo, monto,
        pagado_por_id, deudor_cliente_id, deudor_usuario_id,
        estado_id, fecha, deudor_automatico, ticket_url
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        obra_id, especialidad_id, descripcion, motivo ?? null, monto,
        pagador_id, deudor_cliente_final, deudor_usuario_final,
        16, fecha, deudor_automatico, ticket_url ?? null,
      ]
    );

    const gastoId = result.rows[0].id;

    for (const fp of formas_pago) {
      await client.query(
        `INSERT INTO gastos_imprevistos_formas_pago (gasto_id, forma_pago_id, monto)
         VALUES ($1, $2, $3)`,
        [gastoId, fp.forma_pago_id, fp.monto]
      );
    }

    await client.query('COMMIT');

    // Notificar a admins
    await notificar({
      tipo:       'gasto_imprevisto_creado',
      mensaje:    `Nuevo gasto imprevisto de ${formatMoney(monto)} registrado en "${obra.nombre}"`,
      usuario_id: null,
    });

    // Notificar al pagador si tiene usuario_id
    const resPagador = await pool.query(
      `SELECT usuario_id FROM trabajadores WHERE id = $1
       UNION
       SELECT id AS usuario_id FROM usuarios WHERE id = $1`,
      [pagador_id]
    );
    if (resPagador.rows[0]?.usuario_id) {
      await notificar({
        tipo:       'gasto_imprevisto_creado',
        mensaje:    `Se registró un gasto imprevisto a tu nombre por ${formatMoney(monto)}`,
        usuario_id: resPagador.rows[0].usuario_id,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Gasto imprevisto registrado con éxito',
      data: result.rows[0],
    });

  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Error al registrar el gasto imprevisto', error: error.message });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// OBTENER TODOS (excluye borrados) — workers solo ven los suyos
// ─────────────────────────────────────────────────────────────
const obtenerGastosImprevistos = async (req, res) => {
  try {
    const esWorker = ROLES_WORKER.includes(req.user.rol_id);
    let whereExtra = '';
    let params = [];

    if (esWorker) {
      const resTrabajador = await pool.query(
        `SELECT id FROM trabajadores WHERE usuario_id = $1`,
        [req.user.userId]
      );
      if (resTrabajador.rows.length === 0)
        return res.status(200).json({ success: true, data: [] });

      const trabajadorId = resTrabajador.rows[0].id;
      whereExtra = `AND gi.pagado_por_id = $1`;
      params = [trabajadorId];
    }

    const result = await pool.query(
      `SELECT gi.*,
              o.nombre   AS obra_nombre,
              e.nombre   AS especialidad_nombre,
              est.nombre AS estado_nombre,
              COALESCE(u.nombre, tp.nombre || ' ' || tp.apellido) AS pagado_por_nombre
       FROM gastos_imprevistos gi
       LEFT JOIN obras          o   ON o.id   = gi.obra_id
       LEFT JOIN especialidades e   ON e.id   = gi.especialidad_id
       LEFT JOIN estados        est ON est.id = gi.estado_id
       LEFT JOIN usuarios       u   ON u.id   = gi.pagado_por_id
       LEFT JOIN trabajadores   tp  ON tp.id  = gi.pagado_por_id
       WHERE gi.estado_id != 15 ${whereExtra}
       ORDER BY gi.fecha DESC`,
      params
    );

    const gastoIds = result.rows.map(g => g.id);
    const formasPagoMap = {};

    if (gastoIds.length > 0) {
      const resFP = await pool.query(
        `SELECT gifp.gasto_id, gifp.monto, fp.nombre AS forma_pago_nombre, gifp.forma_pago_id
         FROM gastos_imprevistos_formas_pago gifp
         LEFT JOIN formas_pago fp ON fp.id = gifp.forma_pago_id
         WHERE gifp.gasto_id = ANY($1)`,
        [gastoIds]
      );
      resFP.rows.forEach(row => {
        if (!formasPagoMap[row.gasto_id]) formasPagoMap[row.gasto_id] = [];
        formasPagoMap[row.gasto_id].push(row);
      });
    }

    const data = result.rows.map(g => ({
      ...g,
      formas_pago: formasPagoMap[g.id] ?? [],
    }));

    return res.status(200).json({ success: true, data });
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
// OBTENER POR ID — workers solo pueden ver los suyos
// ─────────────────────────────────────────────────────────────
const obtenerGastoImprevistoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const esWorker = ROLES_WORKER.includes(req.user.rol_id);

    if (esWorker) {
      const resTrabajador = await pool.query(
        `SELECT id FROM trabajadores WHERE usuario_id = $1`,
        [req.user.userId]
      );
      if (resTrabajador.rows.length === 0)
        return res.status(403).json({ success: false, message: 'No autorizado' });

      const trabajadorId = resTrabajador.rows[0].id;
      const resCheck = await pool.query(
        `SELECT id FROM gastos_imprevistos WHERE id = $1 AND pagado_por_id = $2 AND estado_id != 15`,
        [id, trabajadorId]
      );
      if (resCheck.rows.length === 0)
        return res.status(403).json({ success: false, message: 'No tenés acceso a este gasto' });
    }

    const result = await pool.query(
      `SELECT gi.*,
              o.nombre   AS obra_nombre,
              e.nombre   AS especialidad_nombre,
              est.nombre AS estado_nombre,
              COALESCE(u.nombre, tp.nombre || ' ' || tp.apellido) AS pagado_por_nombre
       FROM gastos_imprevistos gi
       LEFT JOIN obras          o   ON o.id   = gi.obra_id
       LEFT JOIN especialidades e   ON e.id   = gi.especialidad_id
       LEFT JOIN estados        est ON est.id = gi.estado_id
       LEFT JOIN usuarios       u   ON u.id   = gi.pagado_por_id
       LEFT JOIN trabajadores   tp  ON tp.id  = gi.pagado_por_id
       WHERE gi.id = $1 AND gi.estado_id != 15`,
      [id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Gasto imprevisto no encontrado' });

    const resFP = await pool.query(
      `SELECT gifp.monto, gifp.forma_pago_id, fp.nombre AS forma_pago_nombre
       FROM gastos_imprevistos_formas_pago gifp
       LEFT JOIN formas_pago fp ON fp.id = gifp.forma_pago_id
       WHERE gifp.gasto_id = $1`,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: { ...result.rows[0], formas_pago: resFP.rows },
    });
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

    if (req.user.rol_id !== 1)
      return res.status(403).json({
        success: false,
        message: 'Solo el administrador puede cambiar el estado de un gasto imprevisto',
      });

    if (!estado_id)
      return res.status(400).json({ success: false, message: 'Debe especificar estado_id', faltantes: ['estado_id'] });

    const resEstado = await pool.query(
      `SELECT id, nombre FROM estados WHERE id = $1 AND ambito = 'gastos imprevistos'`,
      [estado_id]
    );
    if (resEstado.rows.length === 0)
      return res.status(404).json({ success: false, message: 'El estado especificado no existe o no corresponde a gastos imprevistos' });

    const estadoNombre = resEstado.rows[0].nombre;

    const resGasto = await pool.query(
      `SELECT gi.id, gi.monto, gi.pagado_por_id,
              t.usuario_id AS pagador_usuario_id
       FROM gastos_imprevistos gi
       LEFT JOIN trabajadores t ON t.id = gi.pagado_por_id
       WHERE gi.id = $1 AND gi.estado_id != 15`,
      [id]
    );
    if (resGasto.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Gasto imprevisto no encontrado' });

    const gasto = resGasto.rows[0];

    const result = await pool.query(
      `UPDATE gastos_imprevistos SET estado_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [estado_id, id]
    );

    // Notificar a admins
    await notificar({
      tipo:       'gasto_imprevisto_estado',
      mensaje:    `Gasto imprevisto #${id} cambió a estado "${estadoNombre}"`,
      usuario_id: null,
    });

    // Notificar al pagador si tiene usuario_id
    if (gasto.pagador_usuario_id) {
      await notificar({
        tipo:       'gasto_imprevisto_estado',
        mensaje:    `El estado de tu gasto imprevisto #${id} cambió a "${estadoNombre}"`,
        usuario_id: gasto.pagador_usuario_id,
      });
    }

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

    if (req.user.rol_id !== 1)
      return res.status(403).json({
        success: false,
        message: 'Solo el administrador puede eliminar un gasto imprevisto',
      });

    const resGasto = await pool.query(
      `SELECT id FROM gastos_imprevistos WHERE id = $1 AND estado_id != 15`,
      [id]
    );
    if (resGasto.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Gasto imprevisto no encontrado o ya eliminado' });

    await pool.query(
      `UPDATE gastos_imprevistos SET estado_id = 15 WHERE id = $1`,
      [id]
    );

    return res.status(200).json({ success: true, message: 'Gasto imprevisto eliminado correctamente' });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al eliminar el gasto imprevisto', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// ACTUALIZAR DEUDOR
// ─────────────────────────────────────────────────────────────
const actualizarDeudorGasto = async (req, res) => {
  try {
    const { id } = req.params;
    const { deudor_cliente_id, deudor_usuario_id } = req.body;

    if (deudor_cliente_id && deudor_usuario_id)
      return res.status(400).json({
        success: false,
        message: 'No se puede especificar deudor_cliente_id y deudor_usuario_id al mismo tiempo',
      });

    const resGasto = await pool.query(
      `SELECT id FROM gastos_imprevistos WHERE id = $1 AND estado_id != 15`,
      [id]
    );
    if (resGasto.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Gasto imprevisto no encontrado' });

    const result = await pool.query(
      `UPDATE gastos_imprevistos
       SET deudor_cliente_id = $1, deudor_usuario_id = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [deudor_cliente_id ?? null, deudor_usuario_id ?? null, id]
    );

    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al actualizar deudor', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// SUBIR TICKET
// ─────────────────────────────────────────────────────────────
const subirTicket = async (req, res) => {
  const supabase = getSupabase();
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: 'No se recibió ningún archivo' });

    const ext      = req.file.originalname.split('.').pop();
    const fileName = `ticket-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('ticket-gasto')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error('Error subiendo ticket a Supabase:', error);
      return res.status(500).json({ success: false, message: 'Error al subir el ticket' });
    }

    const { data } = supabase.storage
      .from('ticket-gasto')
      .getPublicUrl(fileName);

    return res.status(200).json({ success: true, url: data.publicUrl });
  } catch (err) {
    console.error('Error en subirTicket:', err);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = {
  crearGastoImprevisto,
  obtenerGastosImprevistos,
  obtenerGastosPorObra,
  obtenerGastoImprevistoPorId,
  actualizarEstadoGasto,
  eliminarGastoImprevisto,
  actualizarDeudorGasto,
  subirTicket,
};