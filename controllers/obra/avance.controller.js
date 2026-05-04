const pool = require('../../connection/db.js');
const { notificar } = require('../../src/helpers/notificar.js');

const ESTADO_LABOR = {
  PLANIFICADA:  10,
  EN_PROCESO:   11,
  AVANZADA:     12,
  MUY_AVANZADA: 13,
  FINALIZADA:   14,
};

const ROLES_ADMIN  = [1, 3, 4, 6];
const ROLES_WORKER = [7, 8];

const calcularEstadoIdPorPorcentaje = (porcentaje, estadoIdActual) => {
  let nuevoEstadoId;
  if      (porcentaje >= 100) nuevoEstadoId = ESTADO_LABOR.FINALIZADA;
  else if (porcentaje >= 75)  nuevoEstadoId = ESTADO_LABOR.MUY_AVANZADA;
  else if (porcentaje >= 50)  nuevoEstadoId = ESTADO_LABOR.AVANZADA;
  else if (porcentaje >= 25)  nuevoEstadoId = ESTADO_LABOR.EN_PROCESO;
  else                        nuevoEstadoId = ESTADO_LABOR.PLANIFICADA;
  return Math.max(nuevoEstadoId, estadoIdActual);
};

// ─────────────────────────────────────────────────────────────
// POST /avances/crear
// ─────────────────────────────────────────────────────────────
const crearAvance = async (req, res) => {
  if (!ROLES_WORKER.includes(req.user.rol_id)) {
    return res.status(403).json({
      success: false,
      message: 'No tenés permisos para registrar avances'
    });
  }

  const { obra_id, labor_id, descripcion, audio_url, imagen_url, porcentaje_cambio } = req.body;

  if (!obra_id || !labor_id) {
    return res.status(400).json({ success: false, message: 'obra_id y labor_id son requeridos' });
  }
  if (!descripcion && !audio_url && !imagen_url) {
    return res.status(400).json({
      success: false,
      message: 'El avance debe incluir al menos una descripción, audio o imagen'
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const trabajadorResult = await client.query(
      `SELECT id, nombre, apellido FROM trabajadores WHERE usuario_id = $1`,
      [req.user.userId]
    );
    if (trabajadorResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'No se encontró un trabajador asociado a tu usuario'
      });
    }

    const trabajador    = trabajadorResult.rows[0];
    const trabajador_id = trabajador.id;

    const laborResult = await client.query(
      `SELECT id, nombre, estado_id FROM labores WHERE id = $1 AND obra_id = $2`,
      [labor_id, obra_id]
    );
    if (laborResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'La labor no existe o no pertenece a la obra indicada'
      });
    }

    const labor = laborResult.rows[0];

    if (labor.estado_id === ESTADO_LABOR.FINALIZADA) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'No se pueden registrar avances en una labor finalizada'
      });
    }

    const insertResult = await client.query(
      `INSERT INTO avances_obra
         (obra_id, labor_id, trabajador_id, descripcion, audio_url, imagen_url,
          porcentaje_cambio, estado, fecha_registro, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente', NOW(), NOW(), NOW())
       RETURNING *`,
      [obra_id, labor_id, trabajador_id, descripcion, audio_url, imagen_url, porcentaje_cambio ?? null]
    );

    if (labor.estado_id === ESTADO_LABOR.PLANIFICADA) {
      await client.query(
        `UPDATE labores SET estado_id = $1, updated_at = NOW() WHERE id = $2`,
        [ESTADO_LABOR.EN_PROCESO, labor_id]
      );
    }

    await client.query('COMMIT');

    // Notificar a admins — usuario_id null = solo admins lo ven
    await notificar({
      tipo:       'avance_creado',
      mensaje:    `${trabajador.nombre} ${trabajador.apellido} registró un avance en la labor "${labor.nombre}"`,
      usuario_id: null,
    });

    return res.status(201).json({ success: true, data: insertResult.rows[0] });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear avance:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /avances/:id/aprobar
// ─────────────────────────────────────────────────────────────
const aprobarAvance = async (req, res) => {
  if (!ROLES_ADMIN.includes(req.user.rol_id)) {
    return res.status(403).json({
      success: false,
      message: 'No tenés permisos para aprobar avances'
    });
  }

  const { id }             = req.params;
  const { observacion_admin } = req.body;
  const admin_usuario_id   = req.user.userId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const avanceResult = await client.query(
      `SELECT ao.*, t.nombre AS trab_nombre, t.apellido AS trab_apellido,
              t.usuario_id, l.nombre AS labor_nombre
       FROM avances_obra ao
       LEFT JOIN trabajadores t ON t.id = ao.trabajador_id
       LEFT JOIN labores      l ON l.id = ao.labor_id
       WHERE ao.id = $1 FOR UPDATE`,
      [id]
    );
    if (avanceResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Avance no encontrado' });
    }

    const avance = avanceResult.rows[0];
    if (avance.estado !== 'pendiente') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: `El avance ya fue ${avance.estado} y no puede modificarse`
      });
    }

    const avanceActualizado = await client.query(
      `UPDATE avances_obra
       SET estado            = 'aprobado',
           aprobado_por      = $1,
           fecha_aprobacion  = NOW(),
           observacion_admin = $2,
           updated_at        = NOW()
       WHERE id = $3 RETURNING *`,
      [admin_usuario_id, observacion_admin ?? null, id]
    );

    const laborResult = await client.query(
      `SELECT id, estado_id FROM labores WHERE id = $1 FOR UPDATE`,
      [avance.labor_id]
    );
    const labor = laborResult.rows[0];

    const porcentajeResult = await client.query(
      `SELECT COALESCE(SUM(porcentaje_cambio), 0) AS total
       FROM avances_obra WHERE labor_id = $1 AND estado = 'aprobado'`,
      [avance.labor_id]
    );
    const porcentajeTotal = Math.min(parseFloat(porcentajeResult.rows[0].total), 100);
    const nuevoEstadoId   = calcularEstadoIdPorPorcentaje(porcentajeTotal, labor.estado_id);

    await client.query(
      `UPDATE labores SET estado_id = $1, updated_at = NOW() WHERE id = $2`,
      [nuevoEstadoId, avance.labor_id]
    );

    await client.query('COMMIT');

    // Notificar al trabajador que su avance fue aprobado
    await notificar({
      tipo:       'avance_aprobado',
      mensaje:    `Tu avance en la labor "${avance.labor_nombre}" fue aprobado`,
      usuario_id: avance.usuario_id, // personal al trabajador + admins lo ven también
    });

    // Si la labor alcanzó un nuevo hito, notificar a admins
    if (nuevoEstadoId !== labor.estado_id) {
      const NOMBRES_ESTADO = {
        11: 'En proceso', 12: 'Avanzada', 13: 'Muy avanzada', 14: 'Finalizada',
      };
      const nombreEstado = NOMBRES_ESTADO[nuevoEstadoId] ?? `estado ${nuevoEstadoId}`;
      await notificar({
        tipo:       'labor_estado',
        mensaje:    `La labor "${avance.labor_nombre}" avanzó a "${nombreEstado}" (${porcentajeTotal}%)`,
        usuario_id: null,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        avance: avanceActualizado.rows[0],
        labor: {
          id:                   avance.labor_id,
          nuevo_estado_id:      nuevoEstadoId,
          porcentaje_acumulado: porcentajeTotal,
        },
      },
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al aprobar avance:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /avances/:id/rechazar
// ─────────────────────────────────────────────────────────────
const rechazarAvance = async (req, res) => {
  if (!ROLES_ADMIN.includes(req.user.rol_id)) {
    return res.status(403).json({
      success: false,
      message: 'No tenés permisos para rechazar avances'
    });
  }

  const { id }             = req.params;
  const { observacion_admin } = req.body;
  const admin_usuario_id   = req.user.userId;

  if (!observacion_admin || observacion_admin.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'observacion_admin es obligatoria al rechazar un avance'
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const avanceResult = await client.query(
      `SELECT ao.id, ao.estado, ao.labor_id,
              t.usuario_id, l.nombre AS labor_nombre
       FROM avances_obra ao
       LEFT JOIN trabajadores t ON t.id = ao.trabajador_id
       LEFT JOIN labores      l ON l.id = ao.labor_id
       WHERE ao.id = $1 FOR UPDATE`,
      [id]
    );
    if (avanceResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Avance no encontrado' });
    }

    const avance = avanceResult.rows[0];
    if (avance.estado !== 'pendiente') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: `El avance ya fue ${avance.estado} y no puede modificarse`
      });
    }

    const result = await client.query(
      `UPDATE avances_obra
       SET estado            = 'rechazado',
           aprobado_por      = $1,
           fecha_aprobacion  = NOW(),
           observacion_admin = $2,
           updated_at        = NOW()
       WHERE id = $3 RETURNING *`,
      [admin_usuario_id, observacion_admin.trim(), id]
    );

    await client.query('COMMIT');

    // Notificar al trabajador que su avance fue rechazado — incluye el motivo
    await notificar({
      tipo:       'avance_rechazado',
      mensaje:    `Tu avance en la labor "${avance.labor_nombre}" fue rechazado: ${observacion_admin.trim()}`,
      usuario_id: avance.usuario_id, // personal al trabajador
    });

    return res.status(200).json({ success: true, data: result.rows[0] });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al rechazar avance:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// GET /avances/getByObra
// ─────────────────────────────────────────────────────────────
const getAvancesByObra = async (req, res) => {
  const { obra_id, labor_id, estado, page = 1, limit = 20 } = req.query;

  if (!obra_id) {
    return res.status(400).json({ success: false, message: 'obra_id es requerido' });
  }

  const pageNum  = Math.max(1, parseInt(page)  || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset   = (pageNum - 1) * limitNum;

  const params  = [obra_id];
  const filters = ['ao.obra_id = $1'];

  if (labor_id) {
    params.push(labor_id);
    filters.push(`ao.labor_id = $${params.length}`);
  }
  if (estado && ['pendiente', 'aprobado', 'rechazado'].includes(estado)) {
    params.push(estado);
    filters.push(`ao.estado = $${params.length}`);
  }

  const whereClause = filters.join(' AND ');

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM avances_obra ao WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataParams = [...params, limitNum, offset];
    const result = await pool.query(
      `SELECT
         ao.id, ao.obra_id, ao.labor_id,
         l.nombre                       AS labor_nombre,
         ao.trabajador_id,
         t.nombre || ' ' || t.apellido  AS trabajador_nombre,
         ao.descripcion,
         ao.fecha_registro,
         ao.audio_url,
         ao.imagen_url,
         ao.estado,
         ao.aprobado_por,
         u.nombre                       AS admin_nombre,
         ao.fecha_aprobacion,
         ao.observacion_admin,
         ao.porcentaje_cambio,
         ao.resultado_vision,
         ao.cambio_detectado,
         ao.imagen_comparada_con_id,
         ao.created_at
       FROM avances_obra ao
       LEFT JOIN labores      l ON l.id = ao.labor_id
       LEFT JOIN trabajadores t ON t.id = ao.trabajador_id
       LEFT JOIN usuarios     u ON u.id = ao.aprobado_por
       WHERE ${whereClause}
       ORDER BY ao.fecha_registro DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });

  } catch (error) {
    console.error('Error al obtener avances:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /avances/:id/vision  — uso exclusivo del worker de IA
// ─────────────────────────────────────────────────────────────
const guardarResultadoVision = async (req, res) => {
  const { id } = req.params;
  const { resultado_vision, porcentaje_cambio, cambio_detectado } = req.body;

  if (!resultado_vision) {
    return res.status(400).json({ success: false, message: 'resultado_vision es requerido' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const avanceResult = await client.query(
      `SELECT id, labor_id, imagen_url, resultado_vision
       FROM avances_obra WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (avanceResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Avance no encontrado' });
    }

    const avance = avanceResult.rows[0];

    if (!avance.imagen_url) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'El avance no tiene imagen asociada para procesar'
      });
    }

    if (avance.resultado_vision !== null) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Este avance ya tiene resultado de visión registrado'
      });
    }

    const anteriorResult = await client.query(
      `SELECT id FROM avances_obra
       WHERE labor_id = $1 AND imagen_url IS NOT NULL AND estado = 'aprobado' AND id < $2
       ORDER BY fecha_registro DESC LIMIT 1`,
      [avance.labor_id, id]
    );
    const imagen_comparada_con_id = anteriorResult.rows[0]?.id ?? null;

    const result = await client.query(
      `UPDATE avances_obra
       SET resultado_vision        = $1,
           porcentaje_cambio       = $2,
           cambio_detectado        = $3,
           imagen_comparada_con_id = $4,
           updated_at              = NOW()
       WHERE id = $5 RETURNING *`,
      [resultado_vision, porcentaje_cambio ?? null, cambio_detectado ?? null, imagen_comparada_con_id, id]
    );

    await client.query('COMMIT');

    return res.status(200).json({ success: true, data: result.rows[0] });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al guardar resultado de visión:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

module.exports = {
  crearAvance,
  aprobarAvance,
  rechazarAvance,
  getAvancesByObra,
  guardarResultadoVision,
};