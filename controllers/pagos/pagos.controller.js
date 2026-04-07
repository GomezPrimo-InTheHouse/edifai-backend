const pool = require('../../connection/db.js');

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

const getPagosByTrabajador = async (req, res) => {
  const { trabajador_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.*, pr.nombre as presupuesto_nombre, fp.nombre as forma_pago_nombre
      FROM pagos p
      LEFT JOIN presupuestos pr ON p.presupuesto_id = pr.id
      LEFT JOIN formas_pago fp ON p.forma_pago_id = fp.id
      WHERE p.trabajador_id = $1
      ORDER BY p.fecha DESC
    `, [trabajador_id]);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
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

    // Calcula saldo pendiente
    const presupuesto = await pool.query(`SELECT total_estimado FROM presupuestos WHERE id = $1`, [presupuesto_id]);
    const totalPresupuesto = Number(presupuesto.rows[0]?.total_estimado ?? 0);
    const totalPagado = result.rows
      .filter(p => p.estado === 'Pagado')
      .reduce((acc, p) => acc + Number(p.monto), 0);
    const saldoPendiente = totalPresupuesto - totalPagado;

    res.status(200).json({ success: true, data: result.rows, saldo_pendiente: saldoPendiente, total_presupuesto: totalPresupuesto });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const createPago = async (req, res) => {
  const { presupuesto_id, trabajador_id, monto, fecha, motivo, forma_pago_id, estado } = req.body;
  if (!presupuesto_id || !trabajador_id || !monto || !fecha)
    return res.status(400).json({ success: false, message: 'Faltan campos obligatorios: presupuesto_id, trabajador_id, monto, fecha' });
  try {
    const result = await pool.query(`
      INSERT INTO pagos (presupuesto_id, trabajador_id, monto, fecha, motivo, forma_pago_id, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [presupuesto_id, trabajador_id, monto, fecha, motivo ?? null, forma_pago_id ?? null, estado ?? 'Pendiente']);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al crear pago:', error.message);
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
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
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
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const deletePago = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM pagos WHERE id = $1`, [id]);
    res.status(200).json({ success: true, message: 'Pago eliminado.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = {
  getAllPagos, getPagoById, createPago, updatePago,
  deletePago, cambiarEstadoPago, getPagosByTrabajador, getPagosByPresupuesto,
};