const pool = require('../../connection/db.js');
const { getFiltro, ROL_ADMIN_PRIVADO } = require('../../middlewares/filtrarPorPropietario.js');

async function resolverObraId({ obra_id, obra_nombre }, req) {
  if (obra_id) return { id: obra_id };
  if (!obra_nombre) return { error: 'Debe especificar obra_id u obra_nombre' };

  const { where, params } = getFiltro(req);
  const valores = [...params, `%${obra_nombre}%`];

  const result = await pool.query(`
    SELECT id, nombre, ubicacion FROM obras o
    WHERE o.nombre ILIKE $${valores.length}
      AND o.archivado = FALSE
      AND o.estado_id NOT IN (21, 22)
    ${where}
    ORDER BY o.id DESC
  `, valores);

  if (result.rowCount === 0) return { error: `No se encontró ninguna obra con el nombre "${obra_nombre}"` };
  if (result.rowCount === 1) return { id: result.rows[0].id, nombre: result.rows[0].nombre };

  return {
    error: `Hay ${result.rowCount} obras que coinciden con "${obra_nombre}". Pedile al usuario que aclare cuál.`,
    coincidencias: result.rows,
  };
}

const TOOLS = [
  {
    name: 'consultar_obras',
    description: 'Lista obras activas (no archivadas ni eliminadas) con filtros opcionales. Incluye gastos totales por obra.',
    input_schema: {
      type: 'object',
      properties: {
        estado_id:       { type: 'integer', description: '18=Activo, 19=Finalizada, 20=Pausada' },
        busqueda:        { type: 'string' },
        por_vencer_dias: { type: 'integer', description: 'Obras con fecha_fin en los próximos N días' },
      },
    },
  },
  {
    name: 'consultar_resumen_obra',
    description: 'Resumen completo de una obra: labores activas, trabajadores, presupuestos, gastos imprevistos y costo total. Nunca le pidas el ID al usuario — usá obra_nombre.',
    input_schema: {
      type: 'object',
      properties: {
        obra_id:     { type: 'integer' },
        obra_nombre: { type: 'string', description: 'Nombre o parte del nombre de la obra' },
      },
    },
  },
  {
    name: 'consultar_costo_total_obra',
    description: 'Análisis financiero completo de una obra: materiales + mano de obra + gastos imprevistos. Usar cuando pregunten cuánto se gastó, costó o invirtió en una obra.',
    input_schema: {
      type: 'object',
      properties: {
        obra_id:     { type: 'integer' },
        obra_nombre: { type: 'string' },
      },
    },
  },
  {
    name: 'consultar_labores',
    description: 'Lista labores activas (excluye eliminadas y las de obras archivadas/eliminadas). Para filtrar por obra, usá obra_nombre.',
    input_schema: {
      type: 'object',
      properties: {
        obra_id:        { type: 'integer' },
        obra_nombre:    { type: 'string' },
        estado_id:      { type: 'integer', description: '10=Planificada, 11=En proceso, 12=Avanzada, 13=Muy avanzada, 14=Finalizada' },
        trabajador_id:  { type: 'integer' },
        atrasadas:      { type: 'boolean', description: 'true para traer solo labores con fecha vencida sin finalizar' },
        no_finalizadas: { type: 'boolean', description: 'true para traer todas las labores que no están finalizadas ni eliminadas' },
      },
    },
  },
  {
    name: 'consultar_trabajadores',
    description: 'Lista trabajadores con asistencia del mes. Soporta filtro por nombre, especialidad o capacidad ociosa.',
    input_schema: {
      type: 'object',
      properties: {
        busqueda:        { type: 'string' },
        especialidad_id: { type: 'integer' },
        sin_labores:     { type: 'boolean', description: 'true para traer solo trabajadores sin labores activas' },
        ordenar_por:     { type: 'string', enum: ['asistencia_asc', 'asistencia_desc', 'nombre'] },
      },
    },
  },
  {
    name: 'consultar_pagos',
    description: 'Lista pagos con totales. Filtra por trabajador, rango de fechas o estado.',
    input_schema: {
      type: 'object',
      properties: {
        trabajador_id: { type: 'integer' },
        desde:         { type: 'string', description: 'Fecha ISO: 2025-01-01' },
        hasta:         { type: 'string', description: 'Fecha ISO: 2025-12-31' },
        estado:        { type: 'string', enum: ['Pendiente', 'Pagado', 'Parcial', 'Cancelado'] },
      },
    },
  },
  {
    name: 'consultar_presupuestos',
    description: 'Lista presupuestos activos. Para filtrar por obra, usá obra_nombre.',
    input_schema: {
      type: 'object',
      properties: {
        obra_id:     { type: 'integer' },
        obra_nombre: { type: 'string' },
        estado_id:   { type: 'integer' },
        en_borrador: { type: 'boolean', description: 'true para traer solo presupuestos sin confirmar' },
      },
    },
  },
  {
    name: 'consultar_gastos_imprevistos',
    description: 'Lista gastos imprevistos. Para filtrar por obra, usá obra_nombre.',
    input_schema: {
      type: 'object',
      properties: {
        obra_id:     { type: 'integer' },
        obra_nombre: { type: 'string' },
        estado_id:   { type: 'integer', description: '16=activo, 26=parcialmente pagado, 27=saldado' },
      },
    },
  },
  {
    name: 'consultar_ranking_materiales',
    description: 'Rankings de materiales: más usados, menos usados, más caros, más baratos, mayor rotación, sin stock, valor de inventario.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: ['mas_usados', 'menos_usados', 'mas_caros', 'mas_baratos', 'mayor_rotacion', 'sin_stock', 'valor_inventario'],
        },
        limite: { type: 'integer' },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'consultar_estadisticas_financieras',
    description: 'Estadísticas financieras: evolución de pagos por mes, top trabajadores por cobro, presupuesto vs real por obra.',
    input_schema: {
      type: 'object',
      properties: {
        tipo:   { type: 'string', enum: ['pagos_por_mes', 'top_trabajadores_cobro', 'presupuesto_vs_real', 'top_obras_gasto'] },
        limite: { type: 'integer' },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'consultar_estadisticas_obras',
    description: 'Estadísticas de obras: tiempo promedio de finalización, obras con más imprevistos, cumplimiento de fechas.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['tiempo_promedio_labores', 'obras_con_mas_imprevistos', 'cumplimiento_fechas', 'obras_por_estado'] },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'consultar_estadisticas_trabajadores',
    description: 'Estadísticas de RRHH: ranking de asistencia, top por labores finalizadas, trabajadores con pagos pendientes.',
    input_schema: {
      type: 'object',
      properties: {
        tipo:   { type: 'string', enum: ['ranking_asistencia', 'top_labores_finalizadas', 'top_pagos_pendientes', 'ausencias_por_dia'] },
        limite: { type: 'integer' },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'consultar_manual',
    description: 'Consultá el manual operativo de EdifAI SIEMPRE que el usuario pregunte cómo usar el sistema, cómo hacer algo paso a paso, qué significa un término, cómo funciona un módulo o cuáles son las reglas. Usá palabras clave simples en español sin tildes. Por ejemplo: para "como crear una obra" usá consulta: "crear obra". NUNCA respondas preguntas operativas sin consultar esta tool primero.',
    input_schema: {
      type: 'object',
      properties: {
        consulta: {
          type: 'string',
          description: 'La pregunta o tema a buscar en el manual. Usá palabras clave simples sin tildes.',
        },
        modulo: {
          type: 'string',
          description: 'Filtrar por módulo específico (opcional): obras, labores, presupuestos, trabajadores, pagos, presentismo, materiales, gastos_imprevistos, market, dashboard, puntos, ia, general',
        },
      },
      required: ['consulta'],
    },
  },
  {
    name: 'reportar_consulta_no_resuelta',
    description: 'Usá esta tool SOLO cuando ninguna de las tools disponibles te permite responder la pregunta del usuario. Registra la limitación para revisión futura. Después explicale honestamente al usuario que no podés responder eso todavía.',
    input_schema: {
      type: 'object',
      properties: {
        pregunta_original: { type: 'string' },
        motivo:            { type: 'string' },
      },
      required: ['pregunta_original', 'motivo'],
    },
  },
];

// ── tools ─────────────────────────────────────────────────────

async function consultar_obras({ estado_id, busqueda, por_vencer_dias } = {}, req) {
  const { where, params } = getFiltro(req);
  const condiciones = [
    'o.archivado = FALSE',
    'o.estado_id NOT IN (21, 22)',
  ];
  const valores = [...params];

  if (estado_id)       { valores.push(estado_id);       condiciones.push(`o.estado_id = $${valores.length}`); }
  if (busqueda)        { valores.push(`%${busqueda}%`); condiciones.push(`(o.nombre ILIKE $${valores.length} OR o.ubicacion ILIKE $${valores.length})`); }
  if (por_vencer_dias) { valores.push(por_vencer_dias); condiciones.push(`o.fecha_fin_estimado BETWEEN CURRENT_DATE AND CURRENT_DATE + ($${valores.length} || ' days')::interval`); }

  // Query liviana: sin JOINs pesados, datos agregados por subquery
  const result = await pool.query(`
    SELECT
      o.id,
      o.nombre,
      o.ubicacion,
      o.fecha_inicio_estimado,
      o.fecha_fin_estimado,
      e.nombre AS estado_nombre,
      (SELECT COUNT(*)::int FROM labores l
       WHERE l.obra_id = o.id AND l.archivado = FALSE AND l.estado_id != 2) AS cantidad_labores,
      (SELECT COUNT(DISTINCT trabajador_id)::int FROM trabajadores_obras
       WHERE obra_id = o.id) AS trabajadores_asignados,
      (SELECT COALESCE(SUM(total_estimado), 0)::numeric FROM presupuestos
       WHERE obra_id = o.id AND archivado = FALSE) AS total_presupuestado,
      (SELECT COALESCE(SUM(monto), 0)::numeric FROM gastos_imprevistos
       WHERE obra_id = o.id AND estado_id != 15) AS total_imprevistos
    FROM obras o
    LEFT JOIN estados e ON e.id = o.estado_id
    WHERE ${condiciones.join(' AND ')} ${where.replace('AND propietario_id', 'AND o.propietario_id')}
    ORDER BY o.id DESC
    LIMIT 20
  `, valores);

  return result.rows;
}

async function consultar_resumen_obra({ obra_id, obra_nombre } = {}, req) {
  const resuelto = await resolverObraId({ obra_id, obra_nombre }, req);
  if (resuelto.error) return resuelto;
  obra_id = resuelto.id;

  const obra = await pool.query(`SELECT *, propietario_id FROM obras WHERE id = $1`, [obra_id]);
  if (obra.rowCount === 0) return { error: 'Obra no encontrada' };
  if (req.user.rol_id === ROL_ADMIN_PRIVADO && obra.rows[0].propietario_id !== req.user.userId)
    return { error: 'Sin permiso sobre esta obra' };

  const [labores, trabajadores, gastos] = await Promise.all([
    pool.query(`
      SELECT
        l.id, l.nombre, l.descripcion,
        l.fecha_inicio_estimada, l.fecha_fin_estimada,
        l.fecha_inicio_real, l.fecha_fin_real,
        e.nombre   AS estado_nombre,
        t.nombre   AS trabajador_nombre,
        t.apellido AS trabajador_apellido,
        CASE
          WHEN l.fecha_fin_estimada < CURRENT_DATE AND l.estado_id NOT IN (14,2)
          THEN (CURRENT_DATE - l.fecha_fin_estimada::date)
          ELSE 0
        END AS dias_atraso
      FROM labores l
      JOIN obras o ON o.id = l.obra_id
      LEFT JOIN estados e      ON e.id = l.estado_id
      LEFT JOIN trabajadores t ON t.id = l.trabajador_id
      WHERE l.obra_id = $1
        AND l.archivado = FALSE
        AND l.estado_id != 2
        AND o.archivado = FALSE
        AND o.estado_id NOT IN (21, 22)
      ORDER BY l.id ASC
    `, [obra_id]),

    pool.query(`
      SELECT COUNT(DISTINCT trabajador_id)::int AS cantidad
      FROM trabajadores_obras WHERE obra_id = $1
    `, [obra_id]),

    pool.query(`
      SELECT gi.descripcion, gi.monto, gi.fecha, est.nombre AS estado
      FROM gastos_imprevistos gi
      LEFT JOIN estados est ON est.id = gi.estado_id
      WHERE gi.obra_id = $1 AND gi.estado_id != 15
      ORDER BY gi.fecha DESC LIMIT 10
    `, [obra_id]),
  ]);

  const laborIds = labores.rows.map(l => l.id);

  let presupuestosRows = [];
  if (laborIds.length > 0) {
    const presupuestosResult = await pool.query(`
      SELECT
        pr.id, pr.nombre, pr.total_estimado, pr.costo_mano_obra,
        e.nombre AS estado,
        pr.labor_id
      FROM presupuestos pr
      LEFT JOIN estados e ON e.id = pr.estado_id
      WHERE (pr.labor_id = ANY($1) OR pr.obra_id = $2)
        AND pr.archivado = FALSE
      ORDER BY pr.labor_id ASC NULLS LAST, pr.total_estimado DESC
    `, [laborIds, obra_id]);
    presupuestosRows = presupuestosResult.rows;
  } else {
    const presupuestosResult = await pool.query(`
      SELECT pr.id, pr.nombre, pr.total_estimado, pr.costo_mano_obra,
             e.nombre AS estado, pr.labor_id
      FROM presupuestos pr
      LEFT JOIN estados e ON e.id = pr.estado_id
      WHERE pr.obra_id = $1 AND pr.archivado = FALSE
      ORDER BY pr.total_estimado DESC
    `, [obra_id]);
    presupuestosRows = presupuestosResult.rows;
  }

  const presupuestoIds = presupuestosRows.map(p => p.id);

  let materialesRows = [];
  if (presupuestoIds.length > 0) {
    const materialesResult = await pool.query(`
      SELECT
        pm.presupuesto_id,
        m.nombre AS material_nombre,
        m.unidad,
        pm.cantidad,
        pm.precio_unitario,
        (pm.cantidad * pm.precio_unitario)::numeric AS subtotal
      FROM presupuesto_materiales pm
      JOIN materiales m ON m.id = pm.material_id
      WHERE pm.presupuesto_id = ANY($1)
      ORDER BY pm.presupuesto_id ASC, subtotal DESC
    `, [presupuestoIds]);
    materialesRows = materialesResult.rows;
  }

  // Agrupar materiales por presupuesto_id
  const materialesPorPresupuesto = {};
  for (const mat of materialesRows) {
    if (!materialesPorPresupuesto[mat.presupuesto_id]) {
      materialesPorPresupuesto[mat.presupuesto_id] = [];
    }
    materialesPorPresupuesto[mat.presupuesto_id].push(mat);
  }

  // Agrupar presupuestos por labor_id
  const presupuestosPorLabor = {};
  for (const pr of presupuestosRows) {
    const key = pr.labor_id ? String(pr.labor_id) : 'obra_directa';
    if (!presupuestosPorLabor[key]) presupuestosPorLabor[key] = [];
    presupuestosPorLabor[key].push({
      ...pr,
      materiales: materialesPorPresupuesto[pr.id] ?? [],
    });
  }

  // Labores enriquecidas con presupuestos y materiales
  const laboresEnriquecidas = labores.rows.map(l => ({
    id:                    l.id,
    nombre:                l.nombre,
    descripcion:           l.descripcion,
    trabajador:            l.trabajador_nombre ? `${l.trabajador_nombre} ${l.trabajador_apellido}` : 'Sin asignar',
    estado:                l.estado_nombre ?? 'Sin estado',
    fecha_inicio_estimada: l.fecha_inicio_estimada,
    fecha_fin_estimada:    l.fecha_fin_estimada,
    fecha_inicio_real:     l.fecha_inicio_real,
    fecha_fin_real:        l.fecha_fin_real,
    dias_atraso:           l.dias_atraso,
    presupuestos:          presupuestosPorLabor[String(l.id)] ?? [],
  }));

  const totalPresupuestado = presupuestosRows.reduce((a, p) => a + Number(p.total_estimado ?? 0), 0);
  const totalImprevistos   = gastos.rows.reduce((a, g) => a + Number(g.monto ?? 0), 0);

  return {
    obra:                       obra.rows[0],
    trabajadores_asignados:     trabajadores.rows[0]?.cantidad ?? 0,
    labores:                    laboresEnriquecidas,
    presupuestos_directos_obra: presupuestosPorLabor['obra_directa'] ?? [],
    gastos_imprevistos:         gastos.rows,
    resumen_financiero: {
      total_presupuestado: totalPresupuestado,
      total_imprevistos:   totalImprevistos,
      costo_total:         totalPresupuestado + totalImprevistos,
    },
  };
}

async function consultar_costo_total_obra({ obra_id, obra_nombre } = {}, req) {
  const resuelto = await resolverObraId({ obra_id, obra_nombre }, req);
  if (resuelto.error) return resuelto;
  obra_id = resuelto.id;

  const obra = await pool.query(`SELECT id, nombre, propietario_id FROM obras WHERE id = $1`, [obra_id]);
  if (obra.rowCount === 0) return { error: 'Obra no encontrada' };
  if (req.user.rol_id === ROL_ADMIN_PRIVADO && obra.rows[0].propietario_id !== req.user.userId)
    return { error: 'Sin permiso sobre esta obra' };

  const presupuestos = await pool.query(`
    SELECT pr.id, pr.nombre, pr.costo_mano_obra, pr.total_estimado, e.nombre AS estado,
           l.nombre AS labor_nombre
    FROM presupuestos pr
    LEFT JOIN estados e ON e.id = pr.estado_id
    LEFT JOIN labores l ON l.id = pr.labor_id
    WHERE (pr.obra_id = $1 OR l.obra_id = $1)
      AND pr.archivado = FALSE
      AND (l.id IS NULL OR (l.archivado = FALSE AND l.estado_id != 2))
  `, [obra_id]);

  const presupuestoIds = presupuestos.rows.map(p => p.id);

  let materiales = { rows: [] };
  if (presupuestoIds.length > 0) {
    materiales = await pool.query(`
      SELECT m.nombre, m.unidad, pm.cantidad, pm.precio_unitario,
             (pm.cantidad * pm.precio_unitario)::numeric AS subtotal,
             pr.nombre AS presupuesto_nombre
      FROM presupuesto_materiales pm
      JOIN materiales m  ON m.id  = pm.material_id
      JOIN presupuestos pr ON pr.id = pm.presupuesto_id
      WHERE pm.presupuesto_id = ANY($1)
      ORDER BY subtotal DESC
    `, [presupuestoIds]);
  }

  const gastos = await pool.query(`
    SELECT descripcion, monto, fecha
    FROM gastos_imprevistos
    WHERE obra_id = $1 AND estado_id != 15
    ORDER BY fecha DESC
  `, [obra_id]);

  const pagos = await pool.query(`
    SELECT COALESCE(SUM(monto), 0)::numeric AS total_pagado
    FROM pagos
    WHERE presupuesto_id = ANY($1) AND estado IN ('Pagado', 'Parcial')
  `, [presupuestoIds.length ? presupuestoIds : [0]]);

  const totalManoObra   = presupuestos.rows.reduce((a, p) => a + Number(p.costo_mano_obra ?? 0), 0);
  const totalMateriales = materiales.rows.reduce((a, m) => a + Number(m.subtotal ?? 0), 0);
  const totalImprevistos = gastos.rows.reduce((a, g) => a + Number(g.monto ?? 0), 0);
  const totalGeneral    = totalManoObra + totalMateriales + totalImprevistos;

  return {
    obra: obra.rows[0],
    desglose: {
      mano_de_obra: { total: totalManoObra, detalle: presupuestos.rows },
      materiales:   { total: totalMateriales, detalle: materiales.rows },
      imprevistos:  { total: totalImprevistos, detalle: gastos.rows },
    },
    total_pagado_hasta_ahora: pagos.rows[0]?.total_pagado ?? 0,
    costo_total_obra: totalGeneral,
    saldo_pendiente_estimado: Math.max(0, totalGeneral - Number(pagos.rows[0]?.total_pagado ?? 0)),
  };
}

async function consultar_labores({ obra_id, obra_nombre, estado_id, trabajador_id, atrasadas, no_finalizadas } = {}, req) {
  if (obra_nombre && !obra_id) {
    const resuelto = await resolverObraId({ obra_nombre }, req);
    if (resuelto.error) return resuelto;
    obra_id = resuelto.id;
  }

  const { where, params } = getFiltro(req);
  const condiciones = [
    'l.archivado = FALSE',
    'l.estado_id != 2',
    'o.archivado = FALSE',
    'o.estado_id NOT IN (21, 22)',
  ];
  const valores = [...params];

  if (obra_id)        { valores.push(obra_id);       condiciones.push(`l.obra_id = $${valores.length}`); }
  if (estado_id)      { valores.push(estado_id);     condiciones.push(`l.estado_id = $${valores.length}`); }
  if (trabajador_id)  { valores.push(trabajador_id); condiciones.push(`l.trabajador_id = $${valores.length}`); }
  if (atrasadas)      condiciones.push(`l.fecha_fin_estimada < CURRENT_DATE AND l.estado_id NOT IN (14, 2)`);
  if (no_finalizadas) condiciones.push(`l.estado_id NOT IN (14, 2)`);

  const result = await pool.query(`
    SELECT
      l.id, l.nombre, l.descripcion,
      l.fecha_inicio_estimada, l.fecha_fin_estimada,
      l.fecha_inicio_real, l.fecha_fin_real,
      o.nombre  AS obra_nombre,
      e.nombre  AS estado_nombre,
      t.nombre  AS trabajador_nombre,
      t.apellido AS trabajador_apellido,
      CASE
        WHEN l.fecha_fin_estimada < CURRENT_DATE AND l.estado_id NOT IN (14, 2)
        THEN (CURRENT_DATE - l.fecha_fin_estimada::date)
        ELSE 0
      END AS dias_atraso
    FROM labores l
    JOIN obras o             ON o.id = l.obra_id
    LEFT JOIN estados e      ON e.id = l.estado_id
    LEFT JOIN trabajadores t ON t.id = l.trabajador_id
    WHERE ${condiciones.join(' AND ')} ${where.replace('AND propietario_id', 'AND l.propietario_id')}
    ORDER BY dias_atraso DESC, l.id DESC LIMIT 50
  `, valores);

  return result.rows;
}

async function consultar_trabajadores({ busqueda, especialidad_id, sin_labores, ordenar_por } = {}, req) {
  const { where, params } = getFiltro(req);
  const condiciones = ['1=1'];
  const valores = [...params];

  if (busqueda)        { valores.push(`%${busqueda}%`); condiciones.push(`(t.nombre ILIKE $${valores.length} OR t.apellido ILIKE $${valores.length})`); }
  if (especialidad_id) { valores.push(especialidad_id); condiciones.push(`t.especialidad_id = $${valores.length}`); }
  if (sin_labores)     condiciones.push(`NOT EXISTS (SELECT 1 FROM labores l2 WHERE l2.trabajador_id = t.id AND l2.archivado = FALSE AND l2.estado_id NOT IN (14, 2))`);

  const orden = ordenar_por === 'asistencia_asc'  ? 'pct_asistencia ASC'
              : ordenar_por === 'asistencia_desc' ? 'pct_asistencia DESC'
              : 't.apellido ASC';

  const result = await pool.query(`
    SELECT
      t.id, t.nombre, t.apellido, t.email,
      e.nombre AS especialidad_nombre,
      t.jefe_id,
      ROUND(
        COUNT(DISTINCT DATE(p.fecha))::numeric /
        NULLIF((
          SELECT COUNT(*) FROM generate_series(
            DATE_TRUNC('month', CURRENT_DATE), CURRENT_DATE, '1 day'::interval
          ) gs(day)
          WHERE EXTRACT(DOW FROM gs.day) NOT IN (0, 6)
        ), 0) * 100, 1
      ) AS pct_asistencia,
      COUNT(DISTINCT l.id) FILTER (WHERE l.estado_id NOT IN (14, 2))::int AS labores_activas,
      COUNT(DISTINCT l.id) FILTER (WHERE l.estado_id = 14)::int           AS labores_finalizadas
    FROM trabajadores t
    LEFT JOIN especialidades e ON e.id = t.especialidad_id
    LEFT JOIN presentismos p ON p.trabajador_id = t.id
      AND DATE(p.fecha) >= DATE_TRUNC('month', CURRENT_DATE)
    LEFT JOIN labores l ON l.trabajador_id = t.id AND l.archivado = FALSE
    WHERE ${condiciones.join(' AND ')} ${where.replace('AND propietario_id', 'AND t.propietario_id')}
    GROUP BY t.id, e.nombre
    ORDER BY ${orden} LIMIT 50
  `, valores);

  return result.rows;
}

async function consultar_pagos({ trabajador_id, desde, hasta, estado } = {}, req) {
  const { where, params } = getFiltro(req);
  const condiciones = ['1=1'];
  const valores = [...params];

  if (trabajador_id) { valores.push(trabajador_id); condiciones.push(`p.trabajador_id = $${valores.length}`); }
  if (desde)         { valores.push(desde);          condiciones.push(`p.fecha >= $${valores.length}`); }
  if (hasta)         { valores.push(hasta);          condiciones.push(`p.fecha <= $${valores.length}`); }
  if (estado)        { valores.push(estado);         condiciones.push(`p.estado = $${valores.length}`); }

  const result = await pool.query(`
    SELECT p.id, p.monto, p.fecha, p.estado, p.motivo,
           t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido,
           pr.nombre AS presupuesto_nombre,
           fp.nombre AS forma_pago_nombre
    FROM pagos p
    LEFT JOIN trabajadores t  ON t.id  = p.trabajador_id
    LEFT JOIN presupuestos pr ON pr.id = p.presupuesto_id
    LEFT JOIN formas_pago  fp ON fp.id = p.forma_pago_id
    WHERE ${condiciones.join(' AND ')} ${where.replace('AND propietario_id', 'AND p.propietario_id')}
    ORDER BY p.fecha DESC LIMIT 50
  `, valores);

  const totales = result.rows.reduce((acc, p) => {
    const k = `total_${(p.estado ?? 'sin_estado').toLowerCase()}`;
    acc.total_general += Number(p.monto);
    acc[k] = (acc[k] ?? 0) + Number(p.monto);
    return acc;
  }, { total_general: 0 });

  return { pagos: result.rows, totales };
}

async function consultar_presupuestos({ obra_id, obra_nombre, estado_id, en_borrador } = {}, req) {
  if (obra_nombre && !obra_id) {
    const resuelto = await resolverObraId({ obra_nombre }, req);
    if (resuelto.error) return resuelto;
    obra_id = resuelto.id;
  }

  const { where, params } = getFiltro(req);
  const condiciones = ['pr.archivado = FALSE'];
  const valores = [...params];

  if (obra_id)     { valores.push(obra_id);   condiciones.push(`pr.obra_id = $${valores.length}`); }
  if (estado_id)   { valores.push(estado_id); condiciones.push(`pr.estado_id = $${valores.length}`); }
  if (en_borrador) condiciones.push(`e.nombre = 'Borrador'`);

  const result = await pool.query(`
    SELECT pr.id, pr.nombre, pr.total_estimado, pr.costo_mano_obra,
           e.nombre AS estado_nombre,
           o.nombre AS obra_nombre,
           l.nombre AS labor_nombre
    FROM presupuestos pr
    LEFT JOIN estados e ON e.id  = pr.estado_id
    LEFT JOIN obras o   ON o.id  = pr.obra_id
    LEFT JOIN labores l ON l.id  = pr.labor_id
    WHERE ${condiciones.join(' AND ')} ${where}
    ORDER BY pr.total_estimado DESC LIMIT 50
  `, valores);

  return result.rows;
}

async function consultar_gastos_imprevistos({ obra_id, obra_nombre, estado_id } = {}, req) {
  if (obra_nombre && !obra_id) {
    const resuelto = await resolverObraId({ obra_nombre }, req);
    if (resuelto.error) return resuelto;
    obra_id = resuelto.id;
  }

  const { where, params } = getFiltro(req);
  const condiciones = ['gi.estado_id != 15'];
  const valores = [...params];

  if (obra_id)   { valores.push(obra_id);   condiciones.push(`gi.obra_id = $${valores.length}`); }
  if (estado_id) { valores.push(estado_id); condiciones.push(`gi.estado_id = $${valores.length}`); }

  const result = await pool.query(`
    SELECT gi.id, gi.descripcion, gi.monto, gi.fecha,
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
    WHERE ${condiciones.join(' AND ')} ${where.replace('AND propietario_id', 'AND gi.propietario_id')}
    ORDER BY gi.fecha DESC LIMIT 50
  `, valores);

  const total = result.rows.reduce((a, g) => a + Number(g.monto), 0);
  return { gastos: result.rows, total };
}

async function consultar_ranking_materiales({ tipo, limite = 10 } = {}, req) {
  const { where, params } = getFiltro(req);

  const queries = {
    mas_usados: `
      SELECT m.id, m.nombre, m.unidad, m.precio_unitario,
             COUNT(pm.id)::int AS veces_en_presupuesto,
             SUM(pm.cantidad)::numeric AS cantidad_total_usada
      FROM materiales m
      JOIN presupuesto_materiales pm ON pm.material_id = m.id
      WHERE 1=1 ${where}
      GROUP BY m.id ORDER BY veces_en_presupuesto DESC LIMIT $${params.length + 1}
    `,
    menos_usados: `
      SELECT m.id, m.nombre, m.unidad, m.precio_unitario,
             COUNT(pm.id)::int AS veces_en_presupuesto
      FROM materiales m
      LEFT JOIN presupuesto_materiales pm ON pm.material_id = m.id
      WHERE 1=1 ${where}
      GROUP BY m.id ORDER BY veces_en_presupuesto ASC LIMIT $${params.length + 1}
    `,
    mas_caros: `
      SELECT id, nombre, unidad, precio_unitario, stock_actual
      FROM materiales WHERE 1=1 ${where}
      ORDER BY precio_unitario DESC LIMIT $${params.length + 1}
    `,
    mas_baratos: `
      SELECT id, nombre, unidad, precio_unitario, stock_actual
      FROM materiales WHERE 1=1 ${where}
      ORDER BY precio_unitario ASC LIMIT $${params.length + 1}
    `,
    mayor_rotacion: `
      SELECT m.id, m.nombre, m.unidad,
             SUM(pm.cantidad)::numeric AS unidades_consumidas,
             COUNT(DISTINCT pm.presupuesto_id)::int AS presupuestos
      FROM materiales m
      JOIN presupuesto_materiales pm ON pm.material_id = m.id
      JOIN presupuestos pr ON pr.id = pm.presupuesto_id AND pr.archivado = FALSE
      WHERE 1=1 ${where}
      GROUP BY m.id ORDER BY unidades_consumidas DESC LIMIT $${params.length + 1}
    `,
    sin_stock: `
      SELECT id, nombre, unidad, precio_unitario, stock_actual
      FROM materiales WHERE stock_actual = 0 ${where}
      ORDER BY nombre ASC LIMIT $${params.length + 1}
    `,
    valor_inventario: `
      SELECT id, nombre, unidad, stock_actual, precio_unitario,
             (stock_actual * precio_unitario)::numeric AS valor_total
      FROM materiales WHERE 1=1 ${where}
      ORDER BY valor_total DESC LIMIT $${params.length + 1}
    `,
  };

  const sql = queries[tipo];
  if (!sql) return { error: `Tipo de ranking desconocido: ${tipo}` };

  const result = await pool.query(sql, [...params, limite]);
  return { tipo, resultados: result.rows };
}

async function consultar_estadisticas_financieras({ tipo, limite = 10 } = {}, req) {
  const { where, params } = getFiltro(req);

  if (tipo === 'pagos_por_mes') {
    const r = await pool.query(`
      SELECT TO_CHAR(fecha, 'YYYY-MM') AS mes, TO_CHAR(fecha, 'Mon YY') AS label,
             SUM(monto)::numeric AS total, COUNT(*)::int AS cantidad
      FROM pagos p WHERE 1=1 ${where.replace('AND propietario_id', 'AND p.propietario_id')}
      GROUP BY TO_CHAR(fecha, 'YYYY-MM'), TO_CHAR(fecha, 'Mon YY')
      ORDER BY mes ASC
    `, params);
    return r.rows;
  }

  if (tipo === 'top_trabajadores_cobro') {
    const r = await pool.query(`
      SELECT t.id, t.nombre || ' ' || t.apellido AS trabajador,
             SUM(p.monto)::numeric AS total_cobrado,
             COUNT(p.id)::int AS cantidad_pagos
      FROM pagos p JOIN trabajadores t ON t.id = p.trabajador_id
      WHERE p.estado = 'Pagado' ${where.replace('AND propietario_id', 'AND p.propietario_id')}
      GROUP BY t.id, t.nombre, t.apellido
      ORDER BY total_cobrado DESC LIMIT $${params.length + 1}
    `, [...params, limite]);
    return r.rows;
  }

  if (tipo === 'presupuesto_vs_real') {
    const r = await pool.query(`
      SELECT o.id, o.nombre AS obra,
             COALESCE(SUM(pr.total_estimado), 0)::numeric AS presupuestado,
             COALESCE(SUM(gi.monto), 0)::numeric          AS imprevistos,
             COALESCE(SUM(pr.total_estimado), 0) + COALESCE(SUM(gi.monto), 0) AS costo_total
      FROM obras o
      LEFT JOIN labores l             ON l.obra_id = o.id AND l.archivado = FALSE AND l.estado_id != 2
      LEFT JOIN presupuestos pr       ON (pr.obra_id = o.id OR pr.labor_id = l.id) AND pr.archivado = FALSE
      LEFT JOIN gastos_imprevistos gi ON gi.obra_id = o.id AND gi.estado_id != 15
      WHERE o.archivado = FALSE AND o.estado_id NOT IN (21, 22) ${where}
      GROUP BY o.id ORDER BY costo_total DESC LIMIT $${params.length + 1}
    `, [...params, limite]);
    return r.rows;
  }

  if (tipo === 'top_obras_gasto') {
    const r = await pool.query(`
      SELECT o.id, o.nombre,
             COALESCE(SUM(gi.monto), 0)::numeric AS total_imprevistos,
             COUNT(gi.id)::int                   AS cantidad_imprevistos
      FROM obras o
      LEFT JOIN gastos_imprevistos gi ON gi.obra_id = o.id AND gi.estado_id != 15
      WHERE o.archivado = FALSE AND o.estado_id NOT IN (21, 22) ${where}
      GROUP BY o.id ORDER BY total_imprevistos DESC LIMIT $${params.length + 1}
    `, [...params, limite]);
    return r.rows;
  }

  return { error: `Tipo desconocido: ${tipo}` };
}

async function consultar_estadisticas_obras({ tipo } = {}) {
  if (tipo === 'tiempo_promedio_labores') {
    const r = await pool.query(`
      SELECT
        ROUND(AVG(DATE_PART('day', fecha_fin_real::timestamp - fecha_inicio_real::timestamp)), 1) AS dias_promedio,
        MIN(DATE_PART('day', fecha_fin_real::timestamp - fecha_inicio_real::timestamp))::int      AS dias_minimo,
        MAX(DATE_PART('day', fecha_fin_real::timestamp - fecha_inicio_real::timestamp))::int      AS dias_maximo,
        COUNT(*)::int AS labores_con_datos
      FROM labores l
      JOIN obras o ON o.id = l.obra_id
      WHERE l.estado_id = 14
        AND l.fecha_inicio_real IS NOT NULL
        AND l.fecha_fin_real IS NOT NULL
        AND o.archivado = FALSE
        AND o.estado_id NOT IN (21, 22)
    `);
    return r.rows[0];
  }

  if (tipo === 'obras_con_mas_imprevistos') {
    const r = await pool.query(`
      SELECT o.id, o.nombre,
             COUNT(gi.id)::int      AS cantidad_imprevistos,
             SUM(gi.monto)::numeric AS monto_total,
             MAX(gi.fecha)          AS ultimo_imprevisto
      FROM obras o
      JOIN gastos_imprevistos gi ON gi.obra_id = o.id AND gi.estado_id != 15
      WHERE o.archivado = FALSE AND o.estado_id NOT IN (21, 22)
      GROUP BY o.id ORDER BY monto_total DESC LIMIT 10
    `);
    return r.rows;
  }

  if (tipo === 'cumplimiento_fechas') {
    const r = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado_id = 19)::int                                          AS obras_finalizadas,
        COUNT(*) FILTER (WHERE estado_id = 19 AND fecha_fin_real <= fecha_fin_estimado)::int  AS a_tiempo,
        COUNT(*) FILTER (WHERE estado_id = 19 AND fecha_fin_real > fecha_fin_estimado)::int   AS tardias,
        COUNT(*) FILTER (WHERE estado_id = 18 AND fecha_fin_estimado < CURRENT_DATE)::int     AS activas_vencidas,
        ROUND(
          COUNT(*) FILTER (WHERE estado_id = 19 AND fecha_fin_real <= fecha_fin_estimado)::numeric /
          NULLIF(COUNT(*) FILTER (WHERE estado_id = 19), 0) * 100, 1
        ) AS pct_cumplimiento
      FROM obras WHERE archivado = FALSE AND estado_id NOT IN (21, 22)
    `);
    return r.rows[0];
  }

  if (tipo === 'obras_por_estado') {
    const r = await pool.query(`
      SELECT e.nombre AS estado, COUNT(o.id)::int AS cantidad
      FROM obras o LEFT JOIN estados e ON e.id = o.estado_id
      WHERE o.archivado = FALSE AND o.estado_id NOT IN (21, 22)
      GROUP BY e.nombre ORDER BY cantidad DESC
    `);
    return r.rows;
  }

  return { error: `Tipo desconocido: ${tipo}` };
}

async function consultar_estadisticas_trabajadores({ tipo, limite = 10 } = {}, req) {
  const { where, params } = getFiltro(req);
  const wTrab = where.replace('AND propietario_id', 'AND t.propietario_id');

  if (tipo === 'ranking_asistencia') {
    const r = await pool.query(`
      SELECT t.id, t.nombre || ' ' || t.apellido AS trabajador,
             e.nombre AS especialidad,
             ROUND(
               COUNT(DISTINCT DATE(p.fecha))::numeric /
               NULLIF((
                 SELECT COUNT(*) FROM generate_series(
                   DATE_TRUNC('month', CURRENT_DATE), CURRENT_DATE, '1 day'::interval
                 ) gs(day)
                 WHERE EXTRACT(DOW FROM gs.day) NOT IN (0, 6)
               ), 0) * 100, 1
             ) AS pct_asistencia,
             COUNT(DISTINCT DATE(p.fecha))::int AS dias_presentes
      FROM trabajadores t
      LEFT JOIN especialidades e ON e.id = t.especialidad_id
      LEFT JOIN presentismos p ON p.trabajador_id = t.id
        AND DATE(p.fecha) >= DATE_TRUNC('month', CURRENT_DATE)
      WHERE 1=1 ${wTrab}
      GROUP BY t.id, e.nombre
      ORDER BY pct_asistencia DESC LIMIT $${params.length + 1}
    `, [...params, limite]);
    return r.rows;
  }

  if (tipo === 'top_labores_finalizadas') {
    const r = await pool.query(`
      SELECT t.id, t.nombre || ' ' || t.apellido AS trabajador,
             COUNT(l.id) FILTER (WHERE l.estado_id = 14)::int              AS labores_finalizadas,
             COUNT(l.id) FILTER (WHERE l.estado_id NOT IN (14, 2))::int    AS labores_activas
      FROM trabajadores t
      LEFT JOIN labores l ON l.trabajador_id = t.id AND l.archivado = FALSE
      WHERE 1=1 ${wTrab}
      GROUP BY t.id ORDER BY labores_finalizadas DESC LIMIT $${params.length + 1}
    `, [...params, limite]);
    return r.rows;
  }

  if (tipo === 'top_pagos_pendientes') {
    const r = await pool.query(`
      SELECT t.id, t.nombre || ' ' || t.apellido AS trabajador,
             SUM(p.monto) FILTER (WHERE p.estado = 'Pendiente')::numeric AS monto_pendiente,
             COUNT(p.id) FILTER (WHERE p.estado = 'Pendiente')::int      AS cantidad_pendiente
      FROM trabajadores t
      JOIN pagos p ON p.trabajador_id = t.id
      WHERE 1=1 ${wTrab}
      GROUP BY t.id
      HAVING SUM(p.monto) FILTER (WHERE p.estado = 'Pendiente') > 0
      ORDER BY monto_pendiente DESC LIMIT $${params.length + 1}
    `, [...params, limite]);
    return r.rows;
  }

  if (tipo === 'ausencias_por_dia') {
    const r = await pool.query(`
      SELECT TO_CHAR(fecha, 'Day') AS dia_semana,
             EXTRACT(DOW FROM fecha)::int AS num_dia,
             COUNT(*)::int AS total_presencias
      FROM presentismos
      GROUP BY dia_semana, num_dia
      ORDER BY num_dia ASC
    `);
    return r.rows;
  }

  return { error: `Tipo desconocido: ${tipo}` };
}

async function reportar_consulta_no_resuelta({ pregunta_original, motivo } = {}, req) {
  try {
    await pool.query(
      `INSERT INTO asistente_consultas_no_resueltas
        (usuario_id, sesion_id, pregunta_original, motivo, origen)
       VALUES ($1, $2, $3, $4, 'autoreporte')`,
      [req.user.userId, req.sesionIdActual ?? null, pregunta_original, motivo]
    );
    return { ok: true, mensaje: 'Limitacion registrada para revision futura.' };
  } catch (error) {
    console.error('Error registrando consulta no resuelta:', error);
    return { ok: false };
  }
}


async function consultar_manual({ consulta, modulo } = {}) {
  try {
    const condiciones = ['activo = TRUE'];
    const params = [];

    if (modulo) {
      params.push(modulo);
      condiciones.push(`modulo = $${params.length}`);
    }

    // Búsqueda ILIKE directa — más confiable con texto sin tildes
    params.push(`%${consulta}%`);
    const idxConsulta = params.length;

    // También buscar por palabras individuales
    const palabras = consulta.toLowerCase().split(/\s+/).filter(p => p.length > 3);
    const condicionesBusqueda = [`titulo ILIKE $${idxConsulta}`, `contenido ILIKE $${idxConsulta}`, `keywords ILIKE $${idxConsulta}`];

    for (const palabra of palabras.slice(0, 5)) {
      params.push(`%${palabra}%`);
      const idx = params.length;
      condicionesBusqueda.push(`titulo ILIKE $${idx}`, `contenido ILIKE $${idx}`, `keywords ILIKE $${idx}`);
    }

    const result = await pool.query(`
      SELECT modulo, flujo, titulo, contenido, keywords
      FROM manual_edifai
      WHERE ${condiciones.join(' AND ')}
        AND (${condicionesBusqueda.join(' OR ')})
      ORDER BY orden ASC
      LIMIT 4
    `, params);

    if (result.rowCount === 0)
      return { encontrado: false, mensaje: 'No se encontro informacion sobre ese tema en el manual.' };

    return { encontrado: true, secciones: result.rows };
  } catch (error) {
    console.error('Error consultando manual:', error);
    return { error: 'Error al consultar el manual.' };
  }
}

// ── dispatcher ────────────────────────────────────────────────
const EJECUTORES = {
  consultar_manual,
  consultar_obras,
  consultar_resumen_obra,
  consultar_costo_total_obra,
  consultar_labores,
  consultar_trabajadores,
  consultar_pagos,
  consultar_presupuestos,
  consultar_gastos_imprevistos,
  consultar_ranking_materiales,
  consultar_estadisticas_financieras,
  consultar_estadisticas_obras,
  consultar_estadisticas_trabajadores,
  reportar_consulta_no_resuelta,
};

async function logErrorTool(nombre, input, req, detalleError) {
  try {
    await pool.query(
      `INSERT INTO asistente_consultas_no_resueltas
        (usuario_id, sesion_id, pregunta_original, tool_relacionada, detalle_error, origen)
       VALUES ($1, $2, $3, $4, $5, 'tool_error')`,
      [req.user.userId, req.sesionIdActual ?? null, JSON.stringify(input ?? {}), nombre, detalleError]
    );
  } catch (e) {
    console.error('Error logueando fallo de tool:', e);
  }
}

async function ejecutarTool(nombre, input, req) {
  const fn = EJECUTORES[nombre];
  if (!fn) {
    await logErrorTool(nombre, input, req, 'Tool desconocida — no existe en EJECUTORES');
    return { error: `Tool desconocida: ${nombre}` };
  }
  try {
    return await fn(input, req);
  } catch (error) {
    console.error(`Error ejecutando tool ${nombre}:`, error);
    await logErrorTool(nombre, input, req, error.message);
    return { error: 'Error interno al ejecutar la consulta' };
  }
}

module.exports = { TOOLS, ejecutarTool };