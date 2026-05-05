const pool = require('../../connection/db.js');

// ── Dashboard Admin ───────────────────────────────────────────
const getDashboardAdmin = async (req, res) => {
  const { fecha_desde, fecha_hasta, periodo } = req.query;

  const hoy = new Date();
  let desde, hasta;

  if (fecha_desde && fecha_hasta) {
    desde = fecha_desde;
    hasta = fecha_hasta;
  } else if (periodo === 'semana') {
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - hoy.getDay() + 1);
    desde = lunes.toISOString().split('T')[0];
    hasta = hoy.toISOString().split('T')[0];
  } else if (periodo === 'hoy') {
    desde = hoy.toISOString().split('T')[0];
    hasta = desde;
  } else {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    hasta = hoy.toISOString().split('T')[0];
  }

  try {
    const [
      obrasResult,
      laboresResult,
      trabajadoresResult,
      presupuestosResult,
      pagosResult,
      presentismoResult,
      ausentesResult,
      materialesCriticosResult,
      loginsResult,
      pagosEvolucionResult,
      obrasPorEstadoResult,
      laboresPorProgresoResult,
      actividadRecienteResult,
    ] = await Promise.all([

      // KPI: obras activas
      pool.query(`
        SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE e.nombre = 'En proceso') AS activas
        FROM obras o
        LEFT JOIN estados e ON e.id = o.estado_id
      `),

      // KPI: labores
      pool.query(`
        SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE e.nombre NOT IN ('Finalizada')) AS activas
        FROM labores l
        LEFT JOIN estados e ON e.id = l.estado_id
        WHERE l.estado_id != 2
      `),

      // KPI: trabajadores activos
      pool.query(`
        SELECT COUNT(*) AS total
        FROM trabajadores
        WHERE estado_id = 1
      `),

      // KPI: presupuestos
      pool.query(`
        SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE e.nombre = 'Confirmado') AS confirmados,
          COUNT(*) FILTER (WHERE e.nombre = 'Borrador') AS borradores
        FROM presupuestos p
        LEFT JOIN estados e ON e.id = p.estado_id
      `),

      // KPI: pagos del período
      pool.query(`
        SELECT
          COUNT(*) AS total_pagos,
          COALESCE(SUM(monto) FILTER (WHERE estado = 'Pagado'), 0) AS total_pagado,
          COALESCE(SUM(monto) FILTER (WHERE estado = 'Pendiente'), 0) AS total_pendiente
        FROM pagos
        WHERE DATE(fecha) BETWEEN $1 AND $2
      `, [desde, hasta]),

      // KPI: asistencia hoy
      pool.query(`
        SELECT
          COUNT(DISTINCT trabajador_id) AS presentes_hoy,
          (SELECT COUNT(*) FROM trabajadores WHERE estado_id = 1) AS total_trabajadores
        FROM presentismos
        WHERE DATE(fecha) = CURRENT_DATE
      `),

      // Ausentes hoy
    
pool.query(`
  SELECT DISTINCT ON (t.id)
    t.id,
    t.nombre,
    t.apellido,
    o.nombre AS obra_nombre
  FROM trabajadores_obras tob
  JOIN trabajadores t ON t.id = tob.trabajador_id
  JOIN obras o ON o.id = tob.obra_id
  WHERE t.estado_id = 1
    AND (tob.fecha_hasta IS NULL OR tob.fecha_hasta >= CURRENT_DATE)
    AND t.id NOT IN (
      SELECT DISTINCT trabajador_id FROM presentismos
      WHERE DATE(fecha) = CURRENT_DATE
    )
  ORDER BY t.id, t.apellido
  LIMIT 10
`),
      // Materiales con stock crítico (stock < 10% del promedio)
      pool.query(`
        SELECT id, nombre, stock_actual, unidad
        FROM materiales
        WHERE estado_id = 1
          AND stock_actual < 10
        ORDER BY stock_actual ASC
        LIMIT 5
      `),

      // Logins hoy
      pool.query(`
        SELECT COUNT(*) AS total
        FROM sesiones
        WHERE DATE(created_at) = CURRENT_DATE
      `),

      // Evolución de pagos (últimos 6 meses agrupados por mes)
      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', fecha), 'Mon') AS mes,
          DATE_TRUNC('month', fecha) AS fecha_mes,
          COALESCE(SUM(monto) FILTER (WHERE estado = 'Pagado'), 0) AS total
        FROM pagos
        WHERE fecha >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', fecha)
        ORDER BY fecha_mes ASC
      `),

      // Obras por estado (para dona)
      pool.query(`
        SELECT e.nombre AS estado, COUNT(*) AS total
        FROM obras o
        LEFT JOIN estados e ON e.id = o.estado_id
        GROUP BY e.nombre
        ORDER BY total DESC
      `),

      // Labores por progreso
      pool.query(`
        SELECT e.nombre AS estado, COUNT(*) AS total
        FROM labores l
        LEFT JOIN estados e ON e.id = l.estado_id
        WHERE l.estado_id != 2
        GROUP BY e.nombre
        ORDER BY total DESC
      `),

      // Actividad reciente (notificaciones)
      pool.query(`
        SELECT tipo, mensaje, created_at
        FROM notificaciones
        ORDER BY created_at DESC
        LIMIT 8
      `),
    ]);

    const presentismo = presentismoResult.rows[0];
    const tasaAsistencia = presentismo.total_trabajadores > 0
      ? Math.round((presentismo.presentes_hoy / presentismo.total_trabajadores) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        periodo: { desde, hasta },
        kpis: {
          obras: {
            total:   Number(obrasResult.rows[0].total),
            activas: Number(obrasResult.rows[0].activas),
          },
          labores: {
            total:   Number(laboresResult.rows[0].total),
            activas: Number(laboresResult.rows[0].activas),
          },
          trabajadores: {
            total: Number(trabajadoresResult.rows[0].total),
          },
          presupuestos: {
            total:       Number(presupuestosResult.rows[0].total),
            confirmados: Number(presupuestosResult.rows[0].confirmados),
            borradores:  Number(presupuestosResult.rows[0].borradores),
          },
          pagos: {
            total_pagos:    Number(pagosResult.rows[0].total_pagos),
            total_pagado:   Number(pagosResult.rows[0].total_pagado),
            total_pendiente: Number(pagosResult.rows[0].total_pendiente),
          },
          asistencia: {
            presentes_hoy:     Number(presentismo.presentes_hoy),
            total_trabajadores: Number(presentismo.total_trabajadores),
            tasa:              tasaAsistencia,
          },
          materiales_criticos: Number(materialesCriticosResult.rows.length),
          logins_hoy:          Number(loginsResult.rows[0].total),
        },
        ausentes_hoy:        ausentesResult.rows,
        materiales_criticos: materialesCriticosResult.rows,
        pagos_evolucion:     pagosEvolucionResult.rows.map(r => ({
          mes:   r.mes,
          total: Number(r.total),
        })),
        obras_por_estado:    obrasPorEstadoResult.rows.map(r => ({
          estado: r.estado ?? 'Sin estado',
          total:  Number(r.total),
        })),
        labores_por_progreso: laboresPorProgresoResult.rows.map(r => ({
          estado: r.estado ?? 'Sin estado',
          total:  Number(r.total),
        })),
        actividad_reciente: actividadRecienteResult.rows,
      },
    });
  } catch (error) {
    console.error('Error getDashboardAdmin:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// ── Dashboard Trabajador ──────────────────────────────────────
const getDashboardTrabajador = async (req, res) => {
  const userId = req.user?.userId;

  if (!userId) return res.status(401).json({ error: 'No autorizado' });

  try {
    // Obtener trabajador vinculado al usuario
    const trabajadorResult = await pool.query(
      `SELECT id, nombre, apellido FROM trabajadores WHERE usuario_id = $1`,
      [userId]
    );

    if (trabajadorResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Trabajador no encontrado' });
    }

    const trabajador = trabajadorResult.rows[0];
    const tid = trabajador.id;
    const mesActual = new Date();
    const desdeMs = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1).toISOString().split('T')[0];
    const hastaMs = mesActual.toISOString().split('T')[0];

    const [
      laboresResult,
      pagosResult,
      asistenciaMesResult,
      ultimosPagosResult,
      obraActualResult,
    ] = await Promise.all([

      // Mis labores activas
      pool.query(`
        SELECT l.*, e.nombre AS estado_nombre
        FROM labores l
        JOIN labores_trabajadores lt ON lt.labor_id = l.id
        LEFT JOIN estados e ON e.id = l.estado_id
        WHERE lt.trabajador_id = $1
          AND l.estado_id != 2
        ORDER BY l.updated_at DESC
      `, [tid]),

      // KPI pagos del mes
      pool.query(`
        SELECT
          COUNT(*) AS total_pagos,
          COALESCE(SUM(monto) FILTER (WHERE estado = 'Pagado'), 0) AS cobrado,
          COALESCE(SUM(monto) FILTER (WHERE estado = 'Pendiente'), 0) AS pendiente
        FROM pagos
        WHERE trabajador_id = $1
          AND DATE(fecha) BETWEEN $2 AND $3
      `, [tid, desdeMs, hastaMs]),

      // Asistencia del mes — días marcados
      pool.query(`
        SELECT DATE(fecha) AS dia
        FROM presentismos
        WHERE trabajador_id = $1
          AND DATE(fecha) BETWEEN $2 AND $3
        ORDER BY dia ASC
      `, [tid, desdeMs, hastaMs]),

      // Últimos 5 pagos
      pool.query(`
        SELECT p.*, fp.nombre AS forma_pago_nombre
        FROM pagos p
        LEFT JOIN formas_pago fp ON fp.id = p.forma_pago_id
        WHERE p.trabajador_id = $1
        ORDER BY p.fecha DESC
        LIMIT 5
      `, [tid]),

      // Obra actual (última vinculación activa)
      pool.query(`
        SELECT o.nombre AS obra_nombre, tob.rol_en_obra
        FROM trabajadores_obras tob
        JOIN obras o ON o.id = tob.obra_id
        WHERE tob.trabajador_id = $1
          AND (tob.fecha_hasta IS NULL OR tob.fecha_hasta >= CURRENT_DATE)
        ORDER BY tob.fecha_desde DESC
        LIMIT 1
      `, [tid]),
    ]);

    const pagos = pagosResult.rows[0];
    const diasMarcados = asistenciaMesResult.rows.map(r =>
      new Date(r.dia).toISOString().split('T')[0]
    );

    // Calcular días hábiles del mes para % asistencia
    const diasMes = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0).getDate();
    let diasHabiles = 0;
    for (let d = 1; d <= diasHabiles + 1 && d <= diasMes; d++) {
      const dia = new Date(mesActual.getFullYear(), mesActual.getMonth(), d);
      if (dia.getDay() !== 0 && dia.getDay() !== 6) diasHabiles++;
    }
    // Contar días hábiles correctamente
    diasHabiles = 0;
    for (let d = 1; d <= diasMes; d++) {
      const dia = new Date(mesActual.getFullYear(), mesActual.getMonth(), d);
      if (dia.getDay() !== 0 && dia.getDay() !== 6) diasHabiles++;
    }

    const tasaAsistencia = diasHabiles > 0
      ? Math.round((diasMarcados.length / diasHabiles) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        trabajador,
        obra_actual: obraActualResult.rows[0] ?? null,
        kpis: {
          labores_activas: laboresResult.rows.length,
          cobrado_mes:     Number(pagos.cobrado),
          pendiente_mes:   Number(pagos.pendiente),
          tasa_asistencia: tasaAsistencia,
          dias_marcados:   diasMarcados.length,
          dias_habiles:    diasHabiles,
        },
        labores:          laboresResult.rows,
        dias_asistencia:  diasMarcados,
        ultimos_pagos:    ultimosPagosResult.rows,
        mes_actual: {
          anio: mesActual.getFullYear(),
          mes:  mesActual.getMonth() + 1,
          dias: diasMes,
        },
      },
    });
  } catch (error) {
    console.error('Error getDashboardTrabajador:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = { getDashboardAdmin, getDashboardTrabajador };