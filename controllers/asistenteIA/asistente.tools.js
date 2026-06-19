const pool = require('../../connection/db.js');
const { getFiltro, ROL_ADMIN_PRIVADO } = require('../../middlewares/filtrarPorPropietario.js');

const TOOLS = [
  {
    name: 'consultar_obras',
    description: 'Lista obras con filtros opcionales por estado o búsqueda de texto en nombre/ubicación.',
    input_schema: {
      type: 'object',
      properties: {
        estado_id: { type: 'integer', description: '18=Activo, 19=Finalizada, 20=Pausada, 21=Archivada, 22=Eliminada' },
        busqueda:  { type: 'string',  description: 'Texto a buscar en nombre o ubicación' },
      },
    },
  },
  {
    name: 'consultar_resumen_obra',
    description: 'Resumen de una obra: labores por estado, trabajadores asignados.',
    input_schema: {
      type: 'object',
      properties: { obra_id: { type: 'integer' } },
      required: ['obra_id'],
    },
  },
  {
    name: 'consultar_labores',
    description: 'Lista labores con filtros opcionales por obra, estado o trabajador.',
    input_schema: {
      type: 'object',
      properties: {
        obra_id:       { type: 'integer' },
        estado_id:     { type: 'integer', description: '10=Planificada, 11=En proceso, 12=Avanzada, 13=Muy avanzada, 14=Finalizada' },
        trabajador_id: { type: 'integer' },
      },
    },
  },
  {
    name: 'consultar_trabajadores',
    description: 'Lista trabajadores con filtros opcionales por búsqueda de nombre/apellido o especialidad.',
    input_schema: {
      type: 'object',
      properties: {
        busqueda:       { type: 'string',  description: 'Texto a buscar en nombre o apellido' },
        especialidad_id:{ type: 'integer' },
      },
    },
  },
  {
    name: 'consultar_pagos',
    description: 'Lista pagos con filtros opcionales por trabajador o rango de fechas. Incluye totales.',
    input_schema: {
      type: 'object',
      properties: {
        trabajador_id: { type: 'integer' },
        desde:         { type: 'string', description: 'Fecha ISO: 2025-01-01' },
        hasta:         { type: 'string', description: 'Fecha ISO: 2025-12-31' },
      },
    },
  },
  {
    name: 'consultar_presupuestos',
    description: 'Lista presupuestos con filtros opcionales por obra o estado.',
    input_schema: {
      type: 'object',
      properties: {
        obra_id:   { type: 'integer' },
        estado_id: { type: 'integer' },
      },
    },
  },
  {
    name: 'consultar_gastos_imprevistos',
    description: 'Lista gastos imprevistos con filtros opcionales por obra o estado.',
    input_schema: {
      type: 'object',
      properties: {
        obra_id:   { type: 'integer' },
        estado_id: { type: 'integer', description: '16=activo, 26=parcialmente pagado, 27=saldado' },
      },
    },
  },
  {
    name: 'consultar_materiales',
    description: 'Lista materiales con filtro opcional por búsqueda de nombre o flag de stock crítico (stock_actual = 0).',
    input_schema: {
      type: 'object',
      properties: {
        busqueda:          { type: 'string' },
        solo_stock_critico:{ type: 'boolean', description: 'true para mostrar solo materiales sin stock' },
      },
    },
  },
];

// ── tools ─────────────────────────────────────────────────────

async function consultar_obras({ estado_id, busqueda } = {}, req) {
  const { where, params } = getFiltro(req);
  const condiciones = ['o.archivado = FALSE', 'o.estado_id != 22'];
  const valores = [...params];

  if (estado_id) {
    valores.push(estado_id);
    condiciones.push(`o.estado_id = $${valores.length}`);
  }
  if (busqueda) {
    valores.push(`%${busqueda}%`);
    condiciones.push(`(o.nombre ILIKE $${valores.length} OR o.ubicacion ILIKE $${valores.length})`);
  }

  const result = await pool.query(`
    SELECT o.id, o.nombre, o.ubicacion, o.fecha_inicio_estimado, o.fecha_fin_estimado,
           e.nombre AS estado_nombre
    FROM obras o
    LEFT JOIN estados e ON e.id = o.estado_id
    WHERE ${condiciones.join(' AND ')} ${where}
    ORDER BY o.id DESC LIMIT 50
  `, valores);

  return result.rows;
}

async function consultar_resumen_obra({ obra_id } = {}, req) {
  const obra = await pool.query(
    `SELECT id, nombre, estado_id, propietario_id, ubicacion FROM obras WHERE id = $1`, [obra_id]
  );
  if (obra.rowCount === 0) return { error: 'Obra no encontrada' };
  if (req.user.rol_id === ROL_ADMIN_PRIVADO && obra.rows[0].propietario_id !== req.user.userId)
    return { error: 'Sin permiso sobre esta obra' };

  const labores = await pool.query(`
    SELECT e.nombre AS estado_nombre, COUNT(*)::int AS cantidad
    FROM labores l
    LEFT JOIN estados e ON e.id = l.estado_id
    WHERE l.obra_id = $1 AND l.archivado = FALSE AND (l.estado_id IS NULL OR l.estado_id != 2)
    GROUP BY e.nombre
  `, [obra_id]);

  const trabajadores = await pool.query(`
    SELECT COUNT(DISTINCT trabajador_id)::int AS cantidad FROM trabajadores_obras WHERE obra_id = $1
  `, [obra_id]);

  const gastos = await pool.query(`
    SELECT COALESCE(SUM(monto), 0)::numeric AS total FROM gastos_imprevistos
    WHERE obra_id = $1 AND estado_id != 15
  `, [obra_id]);

  return {
    obra: obra.rows[0],
    labores_por_estado: labores.rows,
    trabajadores_asignados: trabajadores.rows[0]?.cantidad ?? 0,
    total_gastos_imprevistos: gastos.rows[0]?.total ?? 0,
  };
}

async function consultar_labores({ obra_id, estado_id, trabajador_id } = {}, req) {
  const { where, params } = getFiltro(req);
  const condiciones = ['l.archivado = FALSE', '(l.estado_id IS NULL OR l.estado_id != 2)'];
  const valores = [...params];

  if (obra_id)       { valores.push(obra_id);       condiciones.push(`l.obra_id = $${valores.length}`); }
  if (estado_id)     { valores.push(estado_id);     condiciones.push(`l.estado_id = $${valores.length}`); }
  if (trabajador_id) { valores.push(trabajador_id); condiciones.push(`l.trabajador_id = $${valores.length}`); }

  const result = await pool.query(`
    SELECT l.id, l.nombre, l.descripcion, l.fecha_inicio_estimada, l.fecha_fin_estimada,
           o.nombre AS obra_nombre,
           e.nombre AS estado_nombre,
           t.nombre AS trabajador_nombre, t.apellido AS trabajador_apellido
    FROM labores l
    LEFT JOIN obras o       ON o.id = l.obra_id
    LEFT JOIN estados e     ON e.id = l.estado_id
    LEFT JOIN trabajadores t ON t.id = l.trabajador_id
    WHERE ${condiciones.join(' AND ')} ${where.replace('AND propietario_id', 'AND l.propietario_id')}
    ORDER BY l.id DESC LIMIT 50
  `, valores);

  return result.rows;
}

async function consultar_trabajadores({ busqueda, especialidad_id } = {}, req) {
  const { where, params } = getFiltro(req);
  const condiciones = ['1=1'];
  const valores = [...params];

  if (busqueda) {
    valores.push(`%${busqueda}%`);
    condiciones.push(`(t.nombre ILIKE $${valores.length} OR t.apellido ILIKE $${valores.length})`);
  }
  if (especialidad_id) {
    valores.push(especialidad_id);
    condiciones.push(`t.especialidad_id = $${valores.length}`);
  }

  const result = await pool.query(`
    SELECT t.id, t.nombre, t.apellido, t.dni, t.telefono, t.email,
           e.nombre AS especialidad_nombre,
           t.jefe_id,
           ROUND(
             COUNT(DISTINCT DATE(p.fecha))::numeric /
             NULLIF((
               SELECT COUNT(*) FROM generate_series(DATE_TRUNC('month', CURRENT_DATE), CURRENT_DATE, '1 day'::interval) AS gs(day)
               WHERE EXTRACT(DOW FROM gs.day) NOT IN (0,6)
             ), 0) * 100, 0
           ) AS porcentaje_asistencia_mes
    FROM trabajadores t
    LEFT JOIN especialidades e ON e.id = t.especialidad_id
    LEFT JOIN presentismos p ON p.trabajador_id = t.id
      AND DATE(p.fecha) >= DATE_TRUNC('month', CURRENT_DATE)
      AND DATE(p.fecha) <= CURRENT_DATE
    WHERE ${condiciones.join(' AND ')} ${where.replace('AND propietario_id', 'AND t.propietario_id')}
    GROUP BY t.id, e.nombre
    ORDER BY t.apellido ASC LIMIT 50
  `, valores);

  return result.rows;
}

async function consultar_pagos({ trabajador_id, desde, hasta } = {}, req) {
  const { where, params } = getFiltro(req);
  const condiciones = ['1=1'];
  const valores = [...params];

  if (trabajador_id) { valores.push(trabajador_id); condiciones.push(`p.trabajador_id = $${valores.length}`); }
  if (desde)         { valores.push(desde);          condiciones.push(`p.fecha >= $${valores.length}`); }
  if (hasta)         { valores.push(hasta);          condiciones.push(`p.fecha <= $${valores.length}`); }

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
    acc.total_general += Number(p.monto);
    acc[`total_${p.estado?.toLowerCase() ?? 'sin_estado'}`] =
      (acc[`total_${p.estado?.toLowerCase() ?? 'sin_estado'}`] ?? 0) + Number(p.monto);
    return acc;
  }, { total_general: 0 });

  return { pagos: result.rows, totales };
}

async function consultar_presupuestos({ obra_id, estado_id } = {}, req) {
  const { where, params } = getFiltro(req);
  const condiciones = ['pr.archivado = FALSE'];
  const valores = [...params];

  if (obra_id)   { valores.push(obra_id);   condiciones.push(`pr.obra_id = $${valores.length}`); }
  if (estado_id) { valores.push(estado_id); condiciones.push(`pr.estado_id = $${valores.length}`); }

  const result = await pool.query(`
    SELECT pr.id, pr.nombre, pr.descripcion, pr.total_estimado, pr.costo_mano_obra,
           e.nombre AS estado_nombre,
           o.nombre AS obra_nombre,
           l.nombre AS labor_nombre
    FROM presupuestos pr
    LEFT JOIN estados e  ON e.id  = pr.estado_id
    LEFT JOIN obras o    ON o.id  = pr.obra_id
    LEFT JOIN labores l  ON l.id  = pr.labor_id
    WHERE ${condiciones.join(' AND ')} ${where}
    ORDER BY pr.created_at DESC LIMIT 50
  `, valores);

  return result.rows;
}

async function consultar_gastos_imprevistos({ obra_id, estado_id } = {}, req) {
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

  const totalGastos = result.rows.reduce((acc, g) => acc + Number(g.monto), 0);
  return { gastos: result.rows, total: totalGastos };
}

async function consultar_materiales({ busqueda, solo_stock_critico } = {}, req) {
  const { where, params } = getFiltro(req);
  const condiciones = ['1=1'];
  const valores = [...params];

  if (busqueda) {
    valores.push(`%${busqueda}%`);
    condiciones.push(`m.nombre ILIKE $${valores.length}`);
  }
  if (solo_stock_critico) {
    condiciones.push(`m.stock_actual = 0`);
  }

  const result = await pool.query(`
    SELECT m.id, m.nombre, m.unidad, m.stock_actual, m.precio_unitario,
           tm.nombre AS tipo_material_nombre
    FROM materiales m
    LEFT JOIN tipos_material tm ON tm.id = m.tipo_material_id
    WHERE ${condiciones.join(' AND ')} ${where}
    ORDER BY m.nombre ASC LIMIT 50
  `, valores);

  return result.rows;
}

// ── dispatcher ────────────────────────────────────────────────

const EJECUTORES = {
  consultar_obras,
  consultar_resumen_obra,
  consultar_labores,
  consultar_trabajadores,
  consultar_pagos,
  consultar_presupuestos,
  consultar_gastos_imprevistos,
  consultar_materiales,
};

async function ejecutarTool(nombre, input, req) {
  const fn = EJECUTORES[nombre];
  if (!fn) return { error: `Tool desconocida: ${nombre}` };
  try {
    return await fn(input, req);
  } catch (error) {
    console.error(`Error ejecutando tool ${nombre}:`, error);
    return { error: 'Error interno al ejecutar la consulta' };
  }
}

module.exports = { TOOLS, ejecutarTool };