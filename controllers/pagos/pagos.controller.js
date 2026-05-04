const pool = require('../../connection/db.js');
const { notificar } = require('../../src/helpers/notificar');

const getAllPagos = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, t.nombre as trabajador_nombre, t.apellido as trabajador_apellido,
             pr.nombre as presupuesto_nombre, fp.nombre as forma_pago_nombre
      FROM pagos p
      LEFT JOIN trabajadores t ON p.trabajador_id = t.id
      LEFT JOIN presupuestos pr ON p.presupuesto_id = pr.id
      LEFT JOIN formas_pago fp ON p.forma_pago_id = fp.id
      ORDER BY p.created_at DESC
    `);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al obtener pagos:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const getPagoById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.*, t.nombre as trabajador_nombre, t.apellido as trabajador_apellido,
             pr.nombre as presupuesto_nombre, fp.nombre as forma_pago_nombre
      FROM pagos p
      LEFT JOIN trabajadores t ON p.trabajador_id = t.id
      LEFT JOIN presupuestos pr ON p.presupuesto_id = pr.id
      LEFT JOIN formas_pago fp ON p.forma_pago_id = fp.id
      WHERE p.id = $1
    `, [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// const getPagosByTrabajador = async (req, res) => {
//   const { trabajador_id } = req.params;
//   try {
//     const result = await pool.query(`
//       SELECT p.*, pr.nombre as presupuesto_nombre, fp.nombre as forma_pago_nombre
//       FROM pagos p
//       LEFT JOIN presupuestos pr ON p.presupuesto_id = pr.id
//       LEFT JOIN formas_pago fp ON p.forma_pago_id = fp.id
//       WHERE p.trabajador_id = $1
//       ORDER BY p.fecha DESC
//     `, [trabajador_id]);
//     res.status(200).json({ success: true, data: result.rows });
//   } catch (error) {
//     res.status(500).json({ success: false, message: 'Error interno del servidor' });
//   }
// };


const getPagosByTrabajador = async (req, res) => {
  const { trabajador_id } = req.params;
  try {
    const pagosResult = await pool.query(`
      SELECT 
        p.*,
        pr.nombre          AS presupuesto_nombre,
        pr.total_estimado  AS presupuesto_total,
        pr.costo_mano_obra,
        fp.nombre          AS forma_pago_nombre
      FROM pagos p
      LEFT JOIN presupuestos pr ON p.presupuesto_id = pr.id
      LEFT JOIN formas_pago fp  ON p.forma_pago_id  = fp.id
      WHERE p.trabajador_id = $1
      ORDER BY p.fecha DESC
    `, [trabajador_id]);

    const pagos = pagosResult.rows;

    // Deuda real: presupuestos confirmados (estado_id = 5) vinculados a labores del trabajador
    const presupuestosResult = await pool.query(`
      SELECT pr.id, pr.nombre, pr.costo_mano_obra, l.nombre AS labor_nombre
      FROM presupuestos pr
      LEFT JOIN labores l ON l.id = pr.labor_id
      WHERE pr.estado_id = 5
        AND l.trabajador_id = $1
    `, [trabajador_id]);

    const totalManoObra = presupuestosResult.rows.reduce(
      (acc, p) => acc + Number(p.costo_mano_obra ?? 0), 0
    );

    const totalPagado  = pagos.filter(p => p.estado === 'Pagado').reduce((acc, p) => acc + Number(p.monto), 0);
    const totalParcial = pagos.filter(p => p.estado === 'Parcial').reduce((acc, p) => acc + Number(p.monto), 0);
    const totalCobrado = totalPagado + totalParcial;

    res.status(200).json({
      success: true,
      data: pagos,
      presupuestos_confirmados: presupuestosResult.rows,
      resumen: {
        total_mano_obra_comprometida: totalManoObra,
        total_pagado:    totalPagado,
        total_parcial:   totalParcial,
        total_cobrado:   totalCobrado,
        saldo_pendiente: Math.max(0, totalManoObra - totalCobrado),
      },
    });
  } catch (error) {
    console.error('Error en getPagosByTrabajador:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const getPagosByPresupuesto = async (req, res) => {
  const { presupuesto_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.*, t.nombre as trabajador_nombre, t.apellido as trabajador_apellido,
             fp.nombre as forma_pago_nombre
      FROM pagos p
      LEFT JOIN trabajadores t ON p.trabajador_id = t.id
      LEFT JOIN formas_pago fp ON p.forma_pago_id = fp.id
      WHERE p.presupuesto_id = $1
      ORDER BY p.fecha DESC
    `, [presupuesto_id]);

    const presupuesto = await pool.query(
      `SELECT total_estimado FROM presupuestos WHERE id = $1`,
      [presupuesto_id]
    );
    const totalPresupuesto = Number(presupuesto.rows[0]?.total_estimado ?? 0);
    const totalPagado = result.rows
      .filter(p => p.estado === 'Pagado')
      .reduce((acc, p) => acc + Number(p.monto), 0);
    const saldoPendiente = totalPresupuesto - totalPagado;

    res.status(200).json({
      success: true,
      data: result.rows,
      saldo_pendiente: saldoPendiente,
      total_presupuesto: totalPresupuesto,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const createPago = async (req, res) => {
  const { presupuesto_id, trabajador_id, monto, fecha, motivo, forma_pago_id, estado } = req.body;

  if (!presupuesto_id || !trabajador_id || !monto || !fecha)
    return res.status(400).json({
      success: false,
      message: 'Faltan campos obligatorios: presupuesto_id, trabajador_id, monto, fecha',
    });

  try {
    const result = await pool.query(`
      INSERT INTO pagos (presupuesto_id, trabajador_id, monto, fecha, motivo, forma_pago_id, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [presupuesto_id, trabajador_id, monto, fecha, motivo ?? null, forma_pago_id ?? null, estado ?? 'Pendiente']);

    const pago = result.rows[0];

    // Obtener usuario_id del trabajador para notificación personal
    const trabajadorResult = await pool.query(
      `SELECT usuario_id, nombre, apellido FROM trabajadores WHERE id = $1`,
      [trabajador_id]
    );
    const trabajador = trabajadorResult.rows[0];
    const usuarioIdTrabajador = trabajador?.usuario_id ?? null;

    await notificar({
      tipo: 'pago_realizado',
      mensaje: `Se registró un pago de $${monto} para ${trabajador?.nombre ?? ''} ${trabajador?.apellido ?? ''}`,
      usuario_id: usuarioIdTrabajador, // personal del trabajador + admins lo ven
    });

    res.status(201).json({ success: true, data: pago });
  } catch (error) {
    console.error('Error al crear pago:', error.message);
    notificar({
      tipo: 'error_sistema',
      mensaje: `Error al crear pago: ${error.message}`,
      usuario_id: null,
    });
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const updatePago = async (req, res) => {
  const { id } = req.params;
  const { monto, fecha, motivo, forma_pago_id, estado } = req.body;
  try {
    const result = await pool.query(`
      UPDATE pagos SET monto=$1, fecha=$2, motivo=$3, forma_pago_id=$4, estado=$5, updated_at=NOW()
      WHERE id=$6 RETURNING *
    `, [monto, fecha, motivo, forma_pago_id, estado, id]);

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Pago no encontrado' });

    await notificar({
      tipo: 'pago_modificado',
      mensaje: `Pago #${id} fue modificado`,
      usuario_id: null, // global → solo admins
    });

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    notificar({
      tipo: 'error_sistema',
      mensaje: `Error al actualizar pago #${id}: ${error.message}`,
      usuario_id: null,
    });
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const cambiarEstadoPago = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  const estadosValidos = ['Pendiente', 'Pagado', 'Parcial', 'Cancelado'];

  if (!estadosValidos.includes(estado))
    return res.status(400).json({ success: false, message: 'Estado inválido.' });

  try {
    const result = await pool.query(
      `UPDATE pagos SET estado=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [estado, id]
    );

    // Obtener usuario_id del trabajador para notificación personal
    const pago = result.rows[0];
    const trabajadorResult = await pool.query(
      `SELECT usuario_id FROM trabajadores WHERE id = $1`,
      [pago.trabajador_id]
    );
    const usuarioIdTrabajador = trabajadorResult.rows[0]?.usuario_id ?? null;

    await notificar({
      tipo: 'pago_estado',
      mensaje: `Tu pago #${id} cambió a estado: ${estado}`,
      usuario_id: usuarioIdTrabajador, // personal del trabajador + admins
    });

    res.status(200).json({ success: true, data: pago });
  } catch (error) {
    notificar({
      tipo: 'error_sistema',
      mensaje: `Error al cambiar estado de pago #${id}: ${error.message}`,
      usuario_id: null,
    });
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const deletePago = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM pagos WHERE id = $1`, [id]);

    await notificar({
      tipo: 'pago_eliminado',
      mensaje: `Pago #${id} fue eliminado`,
      usuario_id: null, // global → solo admins
    });

    res.status(200).json({ success: true, message: 'Pago eliminado.' });
  } catch (error) {
    notificar({
      tipo: 'error_sistema',
      mensaje: `Error al eliminar pago #${id}: ${error.message}`,
      usuario_id: null,
    });
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const getEstadisticasPagos = async (req, res) => {
  try {
    // 1. Total pagado vs pendiente
    const totalesResult = await pool.query(`
      SELECT
        SUM(CASE WHEN estado = 'Pagado'   THEN monto ELSE 0 END) AS total_pagado,
        SUM(CASE WHEN estado = 'Parcial'  THEN monto ELSE 0 END) AS total_parcial,
        SUM(CASE WHEN estado = 'Pendiente' THEN monto ELSE 0 END) AS total_pendiente,
        SUM(CASE WHEN estado = 'Cancelado' THEN monto ELSE 0 END) AS total_cancelado,
        SUM(monto) AS total_general,
        COUNT(*) AS cantidad_pagos
      FROM pagos
    `);

    // 2. Pagos por trabajador
    const porTrabajadorResult = await pool.query(`
      SELECT
        t.id,
        t.nombre || ' ' || COALESCE(t.apellido, '') AS trabajador,
        SUM(p.monto) AS total_cobrado,
        COUNT(p.id)  AS cantidad_pagos
      FROM pagos p
      LEFT JOIN trabajadores t ON t.id = p.trabajador_id
      GROUP BY t.id, t.nombre, t.apellido
      ORDER BY total_cobrado DESC
      LIMIT 10
    `);

    // 3. Pagos por mes (últimos 12 meses)
    const porMesResult = await pool.query(`
      SELECT
        TO_CHAR(fecha, 'YYYY-MM') AS mes,
        TO_CHAR(fecha, 'Mon YY')  AS mes_label,
        SUM(monto)   AS total,
        COUNT(*)     AS cantidad
      FROM pagos
      WHERE fecha >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(fecha, 'YYYY-MM'), TO_CHAR(fecha, 'Mon YY')
      ORDER BY mes ASC
    `);

    // 4. Distribución por forma de pago
    const porFormaPagoResult = await pool.query(`
      SELECT
        COALESCE(fp.nombre, 'Sin especificar') AS forma_pago,
        SUM(p.monto) AS total,
        COUNT(p.id)  AS cantidad
      FROM pagos p
      LEFT JOIN formas_pago fp ON fp.id = p.forma_pago_id
      GROUP BY fp.nombre
      ORDER BY total DESC
    `);

    res.status(200).json({
      success: true,
      data: {
        totales:        totalesResult.rows[0],
        por_trabajador: porTrabajadorResult.rows,
        por_mes:        porMesResult.rows,
        por_forma_pago: porFormaPagoResult.rows,
      },
    });
  } catch (error) {
    console.error('Error en getEstadisticasPagos:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};



module.exports = {
  getAllPagos, getPagoById, createPago, updatePago,
  deletePago, cambiarEstadoPago, getPagosByTrabajador, getPagosByPresupuesto,
  getEstadisticasPagos
};