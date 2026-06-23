const pool = require('../../connection/db.js');
const Anthropic = require('@anthropic-ai/sdk');
const { getFiltro, getFiltroMateriales } = require('../../middlewares/filtrarPorPropietario.js');

const anthropic = new Anthropic({ apiKey: process.env.ANTRHOPIC_ASISTENTE_RESUMEN_API_KEY });

const iaCache = new Map();
const IA_TTL_MS = 15 * 60 * 1000;

const fmt = (n) => Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0 });
const sev = (c1, c2) => c1 ? 'critico' : c2 ? 'advertencia' : 'info';

// ── Queries por módulo ────────────────────────────────────────

async function labores_atrasadas(req) {
  const { where, params } = getFiltro(req);
  const r = await pool.query(`
    SELECT l.id, l.nombre, o.nombre AS obra_nombre,
      (CURRENT_DATE - l.fecha_fin_estimada::date)::int AS dias_atraso
    FROM labores l
    LEFT JOIN obras o ON o.id = l.obra_id
    WHERE l.archivado = FALSE AND l.fecha_fin_estimada < CURRENT_DATE
    AND l.estado_id NOT IN (14, 2)
    ${where.replace('AND propietario_id', 'AND l.propietario_id')}
    ORDER BY dias_atraso DESC LIMIT 20
  `, params);
  return r.rows.map(i => ({
    id: `labor_${i.id}`, titulo: i.nombre,
    subtitulo: `Obra: ${i.obra_nombre ?? '—'}`,
    detalle: `${i.dias_atraso} día${i.dias_atraso !== 1 ? 's' : ''} de atraso`,
    severidad: sev(i.dias_atraso > 7, i.dias_atraso > 0),
    ruta: `/labores/${i.id}`,
  }));
}

async function presupuestos_borrador(req) {
  const { where, params } = getFiltro(req);
  const r = await pool.query(`
    SELECT pr.id, pr.nombre, pr.total_estimado, o.nombre AS obra_nombre,
      (CURRENT_DATE - pr.created_at::date)::int AS dias_en_borrador
    FROM presupuestos pr
    LEFT JOIN estados e ON e.id = pr.estado_id
    LEFT JOIN obras o ON o.id = pr.obra_id
    WHERE pr.archivado = FALSE AND e.nombre = 'Borrador'
    ${where.replace('AND propietario_id', 'AND pr.propietario_id')}
    ORDER BY dias_en_borrador DESC LIMIT 20
  `, params);
  return r.rows.map(i => ({
    id: `presupuesto_${i.id}`, titulo: i.nombre,
    subtitulo: `Obra: ${i.obra_nombre ?? '—'}`,
    detalle: `$${fmt(i.total_estimado)} — ${i.dias_en_borrador} días sin confirmar`,
    severidad: sev(i.dias_en_borrador > 14, i.dias_en_borrador > 3),
    ruta: `/presupuestos/${i.id}`,
  }));
}

async function pagos_pendientes(req) {
  const { where, params } = getFiltro(req);
  const r = await pool.query(`
    SELECT p.id, p.monto,
      t.nombre || ' ' || t.apellido AS trabajador,
      (CURRENT_DATE - p.fecha::date)::int AS dias_pendiente
    FROM pagos p
    LEFT JOIN trabajadores t ON t.id = p.trabajador_id
    WHERE p.estado = 'Pendiente'
    ${where.replace('AND propietario_id', 'AND p.propietario_id')}
    ORDER BY p.monto DESC LIMIT 20
  `, params);
  return r.rows.map(i => ({
    id: `pago_${i.id}`, titulo: `$${fmt(i.monto)}`,
    subtitulo: i.trabajador ?? 'Sin asignar',
    detalle: `Pendiente hace ${i.dias_pendiente} días`,
    severidad: sev(i.dias_pendiente > 30, i.dias_pendiente > 7),
    ruta: `/pagos/${i.id}`,
  }));
}

async function gastos_sin_saldar(req) {
  const { where, params } = getFiltro(req);
  const r = await pool.query(`
    SELECT gi.id, gi.descripcion, gi.monto, o.nombre AS obra_nombre,
      (CURRENT_DATE - gi.fecha::date)::int AS dias_sin_saldar
    FROM gastos_imprevistos gi
    LEFT JOIN obras o ON o.id = gi.obra_id
    WHERE gi.estado_id = 16
    ${where.replace('AND propietario_id', 'AND gi.propietario_id')}
    ORDER BY gi.monto DESC LIMIT 20
  `, params);
  return r.rows.map(i => ({
    id: `gasto_${i.id}`, titulo: i.descripcion,
    subtitulo: `Obra: ${i.obra_nombre ?? '—'}`,
    detalle: `$${fmt(i.monto)} — ${i.dias_sin_saldar} días sin saldar`,
    severidad: sev(i.dias_sin_saldar > 30, i.dias_sin_saldar > 7),
    ruta: `/gastos-imprevistos`,
  }));
}

async function obras_por_vencer(req, cfg) {
  const { where, params } = getFiltro(req);
  const valores = [...params, cfg.dias_umbral];
  const r = await pool.query(`
    SELECT o.id, o.nombre, o.fecha_fin_estimado,
      (o.fecha_fin_estimado::date - CURRENT_DATE)::int AS dias_restantes
    FROM obras o
    WHERE o.archivado = FALSE AND o.estado_id = 18
    AND o.fecha_fin_estimado BETWEEN CURRENT_DATE
        AND CURRENT_DATE + ($${valores.length} || ' days')::interval
    ${where}
    ORDER BY dias_restantes ASC LIMIT 20
  `, valores);
  return r.rows.map(i => ({
    id: `obra_${i.id}`, titulo: i.nombre,
    subtitulo: `Vence: ${new Date(i.fecha_fin_estimado).toLocaleDateString('es-AR')}`,
    detalle: `${i.dias_restantes} día${i.dias_restantes !== 1 ? 's' : ''} restante${i.dias_restantes !== 1 ? 's' : ''}`,
    severidad: sev(i.dias_restantes <= 7, i.dias_restantes <= 15),
    ruta: `/obras/${i.id}`,
  }));
}

async function materiales_sin_stock(req) {
  const { where, params } = getFiltroMateriales(req);
  const r = await pool.query(`
    SELECT m.id, m.nombre, m.unidad, m.precio_unitario
    FROM materiales m WHERE m.stock_actual <= 0 ${where}
    ORDER BY m.nombre ASC LIMIT 20
  `, params);
  return r.rows.map(i => ({
    id: `material_${i.id}`, titulo: i.nombre,
    subtitulo: `Unidad: ${i.unidad}`,
    detalle: `Sin stock — $${fmt(i.precio_unitario)} c/u`,
    severidad: 'critico',
    ruta: `/materiales/${i.id}`,
  }));
}

async function trabajadores_recientes(req, cfg) {
  const { where, params } = getFiltro(req);
  const valores = [...params, cfg.dias_umbral];
  const r = await pool.query(`
    SELECT t.id, t.nombre, t.apellido, t.created_at, e.nombre AS especialidad
    FROM trabajadores t
    LEFT JOIN especialidades e ON e.id = t.especialidad_id
    WHERE t.created_at >= NOW() - ($${valores.length} || ' days')::interval
    ${where.replace('AND propietario_id', 'AND t.propietario_id')}
    ORDER BY t.created_at DESC LIMIT 10
  `, valores);
  return r.rows.map(i => ({
    id: `trabajador_${i.id}`,
    titulo: `${i.nombre} ${i.apellido}`,
    subtitulo: i.especialidad ?? 'Sin especialidad',
    detalle: `Ingresó ${new Date(i.created_at).toLocaleDateString('es-AR')}`,
    severidad: 'info',
    ruta: `/trabajadores/${i.id}`,
  }));
}

const QUERY_MAP = {
  labores_atrasadas, presupuestos_borrador, pagos_pendientes,
  gastos_sin_saldar, obras_por_vencer, materiales_sin_stock, trabajadores_recientes,
};

// ── Endpoints ─────────────────────────────────────────────────

const obtenerPendientes = async (req, res) => {
  try {
    const config = await pool.query(`SELECT * FROM resumen_config WHERE activo = TRUE ORDER BY id`);

    const resultados = await Promise.all(
      config.rows.map(async (cfg) => {
        const fn = QUERY_MAP[cfg.modulo];
        if (!fn) return null;
        try {
          const items = await fn(req, cfg);
          return {
            modulo: cfg.modulo, label: cfg.label,
            color: cfg.color, icono: cfg.icono,
            ruta_frontend: cfg.ruta_frontend,
            items, total: items.length,
            criticos: items.filter(i => i.severidad === 'critico').length,
          };
        } catch (err) {
          console.error(`Error módulo ${cfg.modulo}:`, err.message);
          return null;
        }
      })
    );

    const categorias       = resultados.filter(Boolean);
    const total_pendientes = categorias.reduce((a, c) => a + c.total, 0);
    const total_criticos   = categorias.reduce((a, c) => a + c.criticos, 0);

    return res.status(200).json({
      success: true,
      data: { categorias, total_pendientes, total_criticos, ultima_actualizacion: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Error en obtenerPendientes:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

const obtenerRecomendacionesIA = async (req, res) => {
  const cacheKey = `ia_res_${req.user.userId}`;
  const cached   = iaCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < IA_TTL_MS)
    return res.status(200).json({ success: true, data: cached.data, fromCache: true });

  try {
    const config  = await pool.query(`SELECT * FROM resumen_config WHERE activo = TRUE ORDER BY id`);
    const resumen = (await Promise.all(
      config.rows.map(async (cfg) => {
        const fn = QUERY_MAP[cfg.modulo];
        if (!fn) return null;
        const items = await fn(req, cfg);
        return { modulo: cfg.label, total: items.length, criticos: items.filter(i => i.severidad === 'critico').length };
      })
    )).filter(Boolean).filter(r => r.total > 0);

    if (!resumen.length)
      return res.status(200).json({ success: true, data: { recomendaciones: [] } });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Sos un asistente de gestión de obras de construcción. Analizá el siguiente resumen de pendientes y generá exactamente 3 recomendaciones de acción concretas priorizadas. Respondé SOLO en JSON sin markdown: {"recomendaciones":[{"titulo":"...","descripcion":"...","prioridad":"alta|media|baja"}]}

Pendientes: ${JSON.stringify(resumen)}`,
      }],
    });

    const text   = response.content.find(b => b.type === 'text')?.text ?? '{}';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    iaCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
    return res.status(200).json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error en recomendaciones IA:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener recomendaciones' });
  }
};

const obtenerConfig = async (_req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM resumen_config ORDER BY id`);
    res.status(200).json({ success: true, data: r.rows });
  } catch { res.status(500).json({ success: false, message: 'Error interno' }); }
};

const actualizarConfig = async (req, res) => {
  const { modulo } = req.params;
  const { activo, dias_umbral, label } = req.body;
  try {
    const r = await pool.query(`
      UPDATE resumen_config SET
        activo      = COALESCE($1, activo),
        dias_umbral = COALESCE($2, dias_umbral),
        label       = COALESCE($3, label),
        updated_at  = NOW()
      WHERE modulo = $4 RETURNING *
    `, [activo ?? null, dias_umbral ?? null, label ?? null, modulo]);
    if (r.rowCount === 0) return res.status(404).json({ success: false, message: 'Módulo no encontrado' });
    res.status(200).json({ success: true, data: r.rows[0] });
  } catch { res.status(500).json({ success: false, message: 'Error interno' }); }
};

module.exports = { obtenerPendientes, obtenerRecomendacionesIA, obtenerConfig, actualizarConfig };