const pool = require('../../connection/db.js');
const { notificar } = require('../../helpers/notificar.js');
const { ROL_ADMIN_PRIVADO } = require('../../middlewares/filtrarPorPropietario.js');

const ESTADO_SIN_ASIGNAR = 29;
const ESTADO_PLANIFICADA = 10;

// ── Helper: verificar acceso a la labor ──────────────────────
const verificarAccesoLabor = async (client, labor_id, user) => {
  const result = await client.query(
    `SELECT id, propietario_id, estado_id, trabajador_id, obra_id, modo FROM labores WHERE id = $1`,
    [labor_id]
  );
  if (result.rowCount === 0) return { error: 404, message: 'Labor no encontrada' };
  const labor = result.rows[0];
  if (user.rol_id === ROL_ADMIN_PRIVADO && labor.propietario_id !== user.userId)
    return { error: 403, message: 'Sin permiso sobre esta labor' };
  return { labor };
};

// ── GET /labor-presupuestos/:labor_id ────────────────────────
const listarPresupuestos = async (req, res) => {
  const { labor_id } = req.params;
  const client = await pool.connect();
  try {
    const { error, message, labor } = await verificarAccesoLabor(client, labor_id, req.user);
    if (error) return res.status(error).json({ success: false, message });

    const result = await client.query(`
      SELECT
        lp.*,
        t.nombre || ' ' || t.apellido AS trabajador_nombre,
        pe.nombre AS proveedor_nombre
      FROM labor_presupuestos lp
      LEFT JOIN trabajadores t ON t.id = lp.trabajador_id
      LEFT JOIN proveedores_externos pe ON pe.id = lp.proveedor_externo_id
      WHERE lp.labor_id = $1
      ORDER BY lp.created_at ASC
    `, [labor_id]);

    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al listar presupuestos:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};


// ── POST /labor-presupuestos/:labor_id ───────────────────────
const agregarPresupuesto = async (req, res) => {
  const { labor_id } = req.params;

  // Sanitizar
  Object.keys(req.body).forEach(key => {
    if (req.body[key] === '') req.body[key] = null;
  });

  const {
    trabajador_id, proveedor_externo_id,
    precio_unitario, cantidad,
    plazo_dias, calidad, garantia, notas, notificar_trabajador,
  } = req.body;

  const client = await pool.connect();
  try {
    if (!precio_unitario)
      return res.status(400).json({ success: false, message: 'El campo precio_unitario es obligatorio' });
    if (!trabajador_id && !proveedor_externo_id)
      return res.status(400).json({ success: false, message: 'Debe indicar trabajador_id o proveedor_externo_id' });
    if (trabajador_id && proveedor_externo_id)
      return res.status(400).json({ success: false, message: 'No puede indicar ambos: trabajador_id y proveedor_externo_id' });

    const { error, message, labor } = await verificarAccesoLabor(client, labor_id, req.user);
    if (error) return res.status(error).json({ success: false, message });

    // Calcular precio_total
    // Prioridad: cantidad del presupuesto → cantidad de la labor → sin multiplicar
    const cantidadFinal = cantidad ?? labor.cantidad ?? null;
    const precioTotal = cantidadFinal
      ? Number(precio_unitario) * Number(cantidadFinal)
      : Number(precio_unitario);

    // Necesitamos cantidad de la labor si no vino en el body
    const laborData = await client.query(
      `SELECT cantidad FROM labores WHERE id = $1`, [labor_id]
    );
    const cantidadLabor = laborData.rows[0]?.cantidad ?? null;
    const cantidadUsada = cantidad ?? cantidadLabor;
    const precioTotalFinal = cantidadUsada
      ? Number(precio_unitario) * Number(cantidadUsada)
      : Number(precio_unitario);

    const result = await client.query(`
      INSERT INTO labor_presupuestos
        (labor_id, trabajador_id, proveedor_externo_id,
         precio_unitario, cantidad, precio_total,
         plazo_dias, calidad, garantia, notas, notificar_trabajador)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [
      labor_id,
      trabajador_id || null,
      proveedor_externo_id || null,
      Number(precio_unitario),
      cantidadUsada || null,
      precioTotalFinal,
      plazo_dias || null,
      calidad || null,
      garantia || null,
      notas || null,
      notificar_trabajador ?? false,
    ]);

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al agregar presupuesto:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

// ── PUT /labor-presupuestos/:id/seleccionar ──────────────────
const seleccionarPresupuesto = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener presupuesto
    const presResult = await client.query(
      `SELECT * FROM labor_presupuestos WHERE id = $1`, [id]
    );
    if (presResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Presupuesto no encontrado' });
    }
    const presupuesto = presResult.rows[0];

    // Verificar acceso y estado de la labor
    const { error, message, labor } = await verificarAccesoLabor(client, presupuesto.labor_id, req.user);
    if (error) {
      await client.query('ROLLBACK');
      return res.status(error).json({ success: false, message });
    }
    if (labor.estado_id !== ESTADO_SIN_ASIGNAR) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Solo se puede confirmar un presupuesto si la labor está Sin asignar' });
    }

    // Marcar seleccionado
    await client.query(
      `UPDATE labor_presupuestos SET estado = 'seleccionado' WHERE id = $1`, [id]
    );

    // Marcar resto como no_seleccionado
    const noSeleccionados = await client.query(`
      UPDATE labor_presupuestos
      SET estado = 'no_seleccionado'
      WHERE labor_id = $1 AND id != $2
      RETURNING id, trabajador_id, notificar_trabajador
    `, [presupuesto.labor_id, id]);

    // Actualizar labor: asignar trabajador si aplica + estado Planificada
    await client.query(`
      UPDATE labores SET
        trabajador_id = $1,
        estado_id = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [presupuesto.trabajador_id || null, ESTADO_PLANIFICADA, presupuesto.labor_id]);

    // Notificar trabajadores no seleccionados si corresponde
    for (const row of noSeleccionados.rows) {
      if (row.notificar_trabajador && row.trabajador_id) {
        // Buscar usuario_id del trabajador
        const usuarioResult = await client.query(
          `SELECT usuario_id FROM trabajadores WHERE id = $1`, [row.trabajador_id]
        );
        if (usuarioResult.rowCount > 0 && usuarioResult.rows[0].usuario_id) {
          await notificar({
            tipo: 'presupuesto_no_seleccionado',
            mensaje: `Tu presupuesto para la labor "${labor.nombre || '#' + presupuesto.labor_id}" no fue seleccionado`,
            usuario_id: usuarioResult.rows[0].usuario_id,
          });
        }
      }
    }

    await client.query('COMMIT');

    await notificar({
      tipo: 'presupuesto_seleccionado',
      mensaje: `Presupuesto confirmado para labor #${presupuesto.labor_id}`,
      usuario_id: null,
    });

    return res.status(200).json({ success: true, message: 'Presupuesto confirmado correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al seleccionar presupuesto:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

// ── DELETE /labor-presupuestos/:id ───────────────────────────
const eliminarPresupuesto = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const presResult = await client.query(
      `SELECT * FROM labor_presupuestos WHERE id = $1`, [id]
    );
    if (presResult.rowCount === 0)
      return res.status(404).json({ success: false, message: 'Presupuesto no encontrado' });

    const { error, message } = await verificarAccesoLabor(client, presResult.rows[0].labor_id, req.user);
    if (error) return res.status(error).json({ success: false, message });

    await client.query(`DELETE FROM labor_presupuestos WHERE id = $1`, [id]);
    return res.status(200).json({ success: true, message: 'Presupuesto eliminado' });
  } catch (error) {
    console.error('Error al eliminar presupuesto:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

const listarUnidades = async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM unidades_medida ORDER BY id`);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al listar unidades:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = { listarPresupuestos, agregarPresupuesto, seleccionarPresupuesto, eliminarPresupuesto,listarUnidades };