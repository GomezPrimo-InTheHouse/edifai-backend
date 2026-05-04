// presupuestos.controller.js - CRUD presupuestos + cambio de estado
// TODO: Implementar controladores CRUD para presupuestos y cambio de estado
const pool = require('../../connection/db.js');
const { notificar } = require('../../src/helpers/notificar.js');

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
    // Presupuesto + datos de la labor + obra + trabajador jefe
    const result = await pool.query(`
      SELECT 
        p.*,
        l.obra_id,
        l.trabajador_id,
        l.nombre        AS labor_nombre,
        o.nombre        AS obra_nombre,
        t.nombre        AS jefe_nombre,
        t.apellido      AS jefe_apellido,
        e.nombre        AS jefe_especialidad
      FROM presupuestos p
      LEFT JOIN labores l       ON l.id = p.labor_id
      LEFT JOIN obras o         ON o.id = l.obra_id
      LEFT JOIN trabajadores t  ON t.id = l.trabajador_id
      LEFT JOIN especialidades e ON e.id = t.especialidad_id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Presupuesto no encontrado' });

    const presupuesto = result.rows[0];

    // Equipo del jefe (trabajadores con jefe_id = trabajador_id de la labor)
    let equipo = [];
    if (presupuesto.trabajador_id) {
      const equipoResult = await pool.query(`
        SELECT 
          t.id, t.nombre, t.apellido,
          e.nombre AS especialidad
        FROM trabajadores t
        LEFT JOIN especialidades e ON e.id = t.especialidad_id
        WHERE t.jefe_id = $1
          AND t.estado_id = 1
        ORDER BY t.apellido
      `, [presupuesto.trabajador_id]);
      equipo = equipoResult.rows;
    }

    res.status(200).json({ success: true, data: { ...presupuesto, equipo } });
  } catch (error) {
    console.error('Error en getPresupuestoById:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const createPresupuesto = async (req, res) => {
  const { nombre, descripcion, labor_id, obra_id, costo_mano_obra } = req.body;

  // Validación básica
  if (!obra_id) {
    return res.status(400).json({ success: false, message: 'obra_id es requerido' });
  }

  try {
    const costoManoObra = Number(costo_mano_obra ?? 0);

    // Verificar que la obra existe
    const obraCheck = await pool.query('SELECT id FROM obras WHERE id = $1', [obra_id]);
    if (obraCheck.rows.length === 0) {
      return res.status(400).json({ success: false, message: `La obra con id ${obra_id} no existe` });
    }

    // Verificar que la labor existe (si se envía)
    if (labor_id) {
      const laborCheck = await pool.query('SELECT id FROM labores WHERE id = $1', [labor_id]);
      if (laborCheck.rows.length === 0) {
        return res.status(400).json({ success: false, message: `La labor con id ${labor_id} no existe` });
      }
    }

    const estadoBorradorResult = await pool.query(
      `SELECT id FROM estados WHERE nombre = 'Borrador' AND ambito = 'presupuesto' LIMIT 1`
    );
    const estadoBorrador = estadoBorradorResult.rows[0]?.id ?? null;

    const result = await pool.query(
      `INSERT INTO presupuestos (nombre, descripcion, labor_id, obra_id, estado_id, total_estimado, costo_mano_obra)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nombre, descripcion, labor_id ?? null, obra_id, estadoBorrador, costoManoObra, costoManoObra]
    );

    await notificar({
      tipo: 'presupuesto_creado',
      mensaje: `Nuevo presupuesto creado: "${nombre}"`,
      usuario_id: null,
    });

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
    await notificar({ tipo: 'presupuesto_modificado', mensaje: `Presupuesto #${id} fue modificado`, usuario_id: null });
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
    await notificar({ tipo: 'presupuesto_eliminado', mensaje: `Presupuesto #${id} fue eliminado`, usuario_id: null });
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
    await notificar({ tipo: 'presupuesto_estado', mensaje: `Presupuesto #${id} cambió de estado`, usuario_id: null });
    res.status(200).json({ success: true, message: 'Estado actualizado correctamente.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al cambiar estado del presupuesto:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

const getPresupuestoContextoPago = async (req, res) => {
  const { id } = req.params;
  try {
    // Presupuesto + labor + obra + trabajador jefe + cliente
    const result = await pool.query(`
      SELECT
        p.id                  AS presupuesto_id,
        p.nombre              AS presupuesto_nombre,
        p.descripcion         AS presupuesto_descripcion,
        p.costo_mano_obra,
        p.total_estimado,
        p.estado_id           AS presupuesto_estado_id,

        l.id                  AS labor_id,
        l.nombre              AS labor_nombre,
        l.descripcion         AS labor_descripcion,
        l.estado_id           AS labor_estado_id,
        el.nombre             AS labor_estado_nombre,

        o.id                  AS obra_id,
        o.nombre              AS obra_nombre,

        t.id                  AS trabajador_id,
        t.nombre              AS trabajador_nombre,
        t.apellido            AS trabajador_apellido,
        e.nombre              AS trabajador_especialidad,

        c.id                  AS cliente_id,
        c.nombre              AS cliente_nombre,
        c.apellido            AS cliente_apellido,
        c.telefono            AS cliente_telefono,
        c.email               AS cliente_email,
        c.dni_cuit            AS cliente_dni_cuit

      FROM presupuestos p
      LEFT JOIN labores l         ON l.id = p.labor_id
      LEFT JOIN estados el        ON el.id = l.estado_id
      LEFT JOIN obras o           ON o.id = l.obra_id
      LEFT JOIN trabajadores t    ON t.id = l.trabajador_id
      LEFT JOIN especialidades e  ON e.id = t.especialidad_id
      LEFT JOIN clientes c        ON c.id = o.cliente_id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Presupuesto no encontrado' });

    const row = result.rows[0];

    // Equipo del jefe
    let equipo = [];
    if (row.trabajador_id) {
      const equipoResult = await pool.query(`
        SELECT t.id, t.nombre, t.apellido, e.nombre AS especialidad
        FROM trabajadores t
        LEFT JOIN especialidades e ON e.id = t.especialidad_id
        WHERE t.jefe_id = $1 AND t.estado_id = 1
        ORDER BY t.apellido
      `, [row.trabajador_id]);
      equipo = equipoResult.rows;
    }

    // Materiales del presupuesto
    let materiales = [];
    const materialesResult = await pool.query(`
      SELECT
        pm.id, pm.cantidad, pm.precio_unitario, pm.subtotal,
        m.nombre AS material_nombre, m.unidad
      FROM presupuesto_materiales pm
      LEFT JOIN materiales m ON m.id = pm.material_id
      WHERE pm.presupuesto_id = $1
    `, [id]);
    materiales = materialesResult.rows;

    res.status(200).json({
      success: true,
      data: {
        presupuesto: {
          id:          row.presupuesto_id,
          nombre:      row.presupuesto_nombre,
          descripcion: row.presupuesto_descripcion,
          costo_mano_obra: row.costo_mano_obra,
          total_estimado:  row.total_estimado,
          estado_id:   row.presupuesto_estado_id,
        },
        labor: {
          id:          row.labor_id,
          nombre:      row.labor_nombre,
          descripcion: row.labor_descripcion,
          estado_id:   row.labor_estado_id,
          estado_nombre: row.labor_estado_nombre,
        },
        obra: {
          id:     row.obra_id,
          nombre: row.obra_nombre,
        },
        trabajador: {
          id:           row.trabajador_id,
          nombre:       row.trabajador_nombre,
          apellido:     row.trabajador_apellido,
          especialidad: row.trabajador_especialidad,
        },
        cliente: row.cliente_id ? {
          id:       row.cliente_id,
          nombre:   row.cliente_nombre,
          apellido: row.cliente_apellido,
          telefono: row.cliente_telefono,
          email:    row.cliente_email,
          dni_cuit: row.cliente_dni_cuit,
        } : null,
        equipo,
        materiales,
      },
    });
  } catch (error) {
    console.error('Error en getPresupuestoContextoPago:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};



module.exports = {
  getAllPresupuestos, getPresupuestoById, createPresupuesto,
  updatePresupuesto, deletePresupuesto, cambiarEstadoPresupuesto, getPresupuestoContextoPago
};