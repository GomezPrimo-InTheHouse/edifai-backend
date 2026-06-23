const pool = require('../../connection/db.js');
const Anthropic = require('@anthropic-ai/sdk');
const { TOOLS, ejecutarTool } = require('./asistente.tools.js');
const { ROLES_ADMIN, ROL_ADMIN_PRIVADO, getFiltro } = require('../../middlewares/filtrarPorPropietario.js');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_MARKET_API_KEY });

// ── Capa 3: Cache en memoria (5 min por usuario) ──────────────
const contextoCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCacheKey(req) {
  return `ctx_${req.user.userId}_${req.user.rol_id}`;
}

function getCacheValido(req) {
  const key = getCacheKey(req);
  const entry = contextoCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    contextoCache.delete(key);
    return null;
  }
  return entry.contexto;
}

function setCache(req, contexto) {
  contextoCache.set(getCacheKey(req), { contexto, timestamp: Date.now() });
}

// ── Capa 1: Contexto del negocio (queries rápidas) ────────────
async function obtenerContextoNegocio(req) {
  const cached = getCacheValido(req);
  if (cached) return cached;

  try {
    const { where, params } = getFiltro(req);
    const wObra   = where;
    const wLabor  = where.replace('AND propietario_id', 'AND l.propietario_id');
    const wPago   = where.replace('AND propietario_id', 'AND p.propietario_id');
    const wGasto  = where.replace('AND propietario_id', 'AND gi.propietario_id');
    const wTrab   = where.replace('AND propietario_id', 'AND t.propietario_id');
    const wPres   = where.replace('AND propietario_id', 'AND pr.propietario_id');
    const wMat    = where;

    const [
      obras, labores, pagos, gastos, trabajadores,
      presupuestos, materiales, estadFinanc, estadObras, estadTrab,
    ] = await Promise.all([

      // OBRAS
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE estado_id = 18)::int                                   AS activas,
          COUNT(*) FILTER (WHERE estado_id = 19)::int                                   AS finalizadas,
          COUNT(*) FILTER (WHERE estado_id = 20)::int                                   AS pausadas,
          COUNT(*) FILTER (WHERE archivado = FALSE AND estado_id != 22)::int             AS total,
          COUNT(*) FILTER (
            WHERE fecha_fin_estimado < CURRENT_DATE AND estado_id NOT IN (19,22)
          )::int                                                                         AS vencidas,
          COUNT(*) FILTER (
            WHERE fecha_fin_estimado BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
            AND estado_id = 18
          )::int                                                                         AS por_vencer
        FROM obras o WHERE 1=1 ${wObra}
      `, params),

      // LABORES
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE l.estado_id = 10)::int                                 AS planificadas,
          COUNT(*) FILTER (WHERE l.estado_id IN (11,12,13))::int                        AS en_progreso,
          COUNT(*) FILTER (WHERE l.estado_id = 14)::int                                 AS finalizadas,
          COUNT(*) FILTER (
            WHERE l.fecha_fin_estimada < CURRENT_DATE AND l.estado_id NOT IN (14,2)
          )::int                                                                         AS atrasadas,
          COUNT(*) FILTER (
            WHERE l.estado_id = 14
            AND DATE_TRUNC('month', COALESCE(l.fecha_fin_real, l.updated_at)) = DATE_TRUNC('month', CURRENT_DATE)
          )::int                                                                         AS finalizadas_este_mes
        FROM labores l
        WHERE l.archivado = FALSE AND (l.estado_id IS NULL OR l.estado_id != 2) ${wLabor}
      `, params),

      // PAGOS
      pool.query(`
        SELECT
          COALESCE(SUM(monto) FILTER (WHERE estado = 'Pendiente'), 0)::numeric          AS monto_pendiente,
          COALESCE(SUM(monto) FILTER (WHERE estado = 'Pagado'), 0)::numeric             AS monto_pagado,
          COALESCE(SUM(monto) FILTER (WHERE estado = 'Parcial'), 0)::numeric            AS monto_parcial,
          COUNT(*) FILTER (WHERE estado = 'Pendiente')::int                             AS cantidad_pendiente,
          COUNT(*) FILTER (WHERE estado = 'Pagado')::int                                AS cantidad_pagados,
          ROUND(
            COUNT(*) FILTER (WHERE estado = 'Pagado')::numeric /
            NULLIF(COUNT(*), 0) * 100, 1
          )                                                                             AS tasa_completados_pct,
          COALESCE(SUM(monto) FILTER (
            WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE)
          ), 0)::numeric                                                                AS pagado_este_mes
        FROM pagos p WHERE 1=1 ${wPago}
      `, params),

      // GASTOS IMPREVISTOS
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE gi.estado_id = 16)::int                               AS activos,
          COALESCE(SUM(gi.monto) FILTER (WHERE gi.estado_id = 16), 0)::numeric         AS total_sin_saldar,
          COALESCE(SUM(gi.monto), 0)::numeric                                           AS total_historico,
          COUNT(*)::int                                                                  AS cantidad_total
        FROM gastos_imprevistos gi WHERE gi.estado_id != 15 ${wGasto}
      `, params),

      // TRABAJADORES
      pool.query(`
        SELECT
          COUNT(*)::int                                                                  AS total,
          COUNT(*) FILTER (WHERE t.jefe_id IS NULL)::int                               AS jefes,
          COUNT(*) FILTER (WHERE t.jefe_id IS NOT NULL)::int                           AS subordinados,
          COUNT(*) FILTER (
            WHERE NOT EXISTS (
              SELECT 1 FROM labores l2
              WHERE l2.trabajador_id = t.id AND l2.archivado = FALSE
              AND l2.estado_id NOT IN (14,2)
            )
          )::int                                                                        AS sin_labores_activas
        FROM trabajadores t WHERE 1=1 ${wTrab}
      `, params),

      // PRESUPUESTOS
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE pr.archivado = FALSE)::int                            AS total_activos,
          COUNT(*) FILTER (WHERE e.nombre = 'Borrador' AND pr.archivado = FALSE)::int  AS en_borrador,
          COUNT(*) FILTER (WHERE e.nombre = 'Confirmado')::int                         AS confirmados,
          COALESCE(SUM(pr.total_estimado) FILTER (WHERE e.nombre = 'Confirmado'), 0)::numeric AS valor_confirmado,
          COALESCE(SUM(pr.total_estimado) FILTER (WHERE e.nombre = 'Borrador' AND pr.archivado = FALSE), 0)::numeric AS valor_borrador
        FROM presupuestos pr
        LEFT JOIN estados e ON e.id = pr.estado_id
        WHERE 1=1 ${wPres}
      `, params),

      // MATERIALES — resumen
      pool.query(`
        SELECT
          COUNT(*)::int                                                                  AS total,
          COUNT(*) FILTER (WHERE stock_actual = 0)::int                                AS sin_stock,
          COUNT(*) FILTER (WHERE stock_actual > 0 AND stock_actual <= 5)::int          AS stock_critico,
          COALESCE(SUM(stock_actual * precio_unitario), 0)::numeric                    AS valor_inventario,
          ROUND(AVG(precio_unitario), 2)::numeric                                      AS precio_promedio
        FROM materiales m WHERE 1=1 ${wMat}
      `, params),

      // ESTADÍSTICAS FINANCIERAS
      pool.query(`
        SELECT
          TO_CHAR(fecha, 'YYYY-MM')                                                    AS mes,
          SUM(monto)::numeric                                                           AS total
        FROM pagos p WHERE estado = 'Pagado' ${wPago}
        GROUP BY TO_CHAR(fecha, 'YYYY-MM')
        ORDER BY total DESC LIMIT 1
      `, params),

      // ESTADÍSTICAS OBRAS — costo promedio y ratio imprevistos
      pool.query(`
        SELECT
          ROUND(AVG(sub.total_presupuesto), 2)::numeric                                AS costo_promedio_obra,
          ROUND(AVG(sub.ratio_imprevistos), 2)::numeric                                AS ratio_imprevistos_pct
        FROM (
          SELECT
            o.id,
            COALESCE(SUM(pr.total_estimado), 0)                                        AS total_presupuesto,
            COALESCE(
              SUM(gi.monto)::numeric / NULLIF(SUM(pr.total_estimado), 0) * 100, 0
            )                                                                           AS ratio_imprevistos
          FROM obras o
          LEFT JOIN labores l ON l.obra_id = o.id AND l.archivado = FALSE
          LEFT JOIN presupuestos pr ON pr.labor_id = l.id OR pr.obra_id = o.id
          LEFT JOIN gastos_imprevistos gi ON gi.obra_id = o.id AND gi.estado_id != 15
          WHERE o.archivado = FALSE AND o.estado_id != 22
          GROUP BY o.id
        ) sub
      `),

      // ESTADÍSTICAS TRABAJADORES — asistencia promedio
      pool.query(`
        SELECT
          ROUND(AVG(sub.pct), 1)::numeric AS asistencia_promedio_pct
        FROM (
          SELECT
            t.id,
            ROUND(
              COUNT(DISTINCT DATE(p.fecha))::numeric /
              NULLIF((
                SELECT COUNT(*) FROM generate_series(
                  DATE_TRUNC('month', CURRENT_DATE),
                  CURRENT_DATE,
                  '1 day'::interval
                ) gs(day)
                WHERE EXTRACT(DOW FROM gs.day) NOT IN (0,6)
              ), 0) * 100, 1
            ) AS pct
          FROM trabajadores t
          LEFT JOIN presentismos p ON p.trabajador_id = t.id
            AND DATE(p.fecha) >= DATE_TRUNC('month', CURRENT_DATE)
          GROUP BY t.id
        ) sub
      `),
    ]);

    const o  = obras.rows[0];
    const l  = labores.rows[0];
    const pg = pagos.rows[0];
    const g  = gastos.rows[0];
    const tr = trabajadores.rows[0];
    const pr = presupuestos.rows[0];
    const mt = materiales.rows[0];
    const ef = estadFinanc.rows[0];
    const eo = estadObras.rows[0];
    const et = estadTrab.rows[0];

    const fmt = (n) => Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    const contexto = `
=== ESTADO ACTUAL DEL NEGOCIO — ${new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ===

── OBRAS ──
- Total activas: ${o.activas} | En pausa: ${o.pausadas} | Finalizadas: ${o.finalizadas} | Total visible: ${o.total}
- ⚠️  Vencidas (fecha superada, no finalizadas): ${o.vencidas}
- 📅 Por vencer en 30 días: ${o.por_vencer}

── LABORES ──
- Planificadas: ${l.planificadas} | En progreso: ${l.en_progreso} | Finalizadas: ${l.finalizadas}
- ⚠️  Atrasadas: ${l.atrasadas}
- ✅ Finalizadas este mes: ${l.finalizadas_este_mes}

── PRESUPUESTOS ──
- Activos: ${pr.total_activos} | Confirmados: ${pr.confirmados} | En borrador: ${pr.en_borrador}
- 💰 Valor confirmado: $${fmt(pr.valor_confirmado)}
- 📝 Valor en borrador (sin cerrar): $${fmt(pr.valor_borrador)}

── PAGOS ──
- Pendientes: ${pg.cantidad_pendiente} pagos por $${fmt(pg.monto_pendiente)}
- Completados: ${pg.cantidad_pagados} | Tasa de completados: ${pg.tasa_completados_pct ?? 0}%
- Pagado este mes: $${fmt(pg.pagado_este_mes)}
- Total histórico pagado: $${fmt(pg.monto_pagado)}
- Mes con mayor egreso: ${ef?.mes ?? 'sin datos'} ($${fmt(ef?.total)})

── GASTOS IMPREVISTOS ──
- Sin saldar: ${g.activos} gastos por $${fmt(g.total_sin_saldar)}
- Total histórico: $${fmt(g.total_historico)} en ${g.cantidad_total} registros

── MATERIALES ──
- Total en inventario: ${mt.total} | Sin stock: ${mt.sin_stock} | Stock crítico (≤5): ${mt.stock_critico}
- 💎 Valor total del inventario: $${fmt(mt.valor_inventario)}
- Precio unitario promedio: $${fmt(mt.precio_promedio)}

── ESTADÍSTICAS ──
- Costo promedio por obra: $${fmt(eo?.costo_promedio_obra)}
- Ratio imprevistos/presupuesto: ${eo?.ratio_imprevistos_pct ?? 0}%
- Asistencia promedio del equipo este mes: ${et?.asistencia_promedio_pct ?? 0}%
- Trabajadores sin labores activas (capacidad ociosa): ${tr.sin_labores_activas} de ${tr.total}
  (${tr.jefes} jefes, ${tr.subordinados} subordinados)

=== FIN DEL CONTEXTO ===
`;

    setCache(req, contexto);
    return contexto;
  } catch (error) {
    console.error('Error obteniendo contexto negocio:', error);
    return '';
  }
}

// ── System prompt ─────────────────────────────────────────────
function buildSystemPrompt(contexto) {
  return `Sos el asistente inteligente de EdifAI, un ERP de gestión de construcción.
Respondés en español rioplatense, de manera breve, concreta y directa.
Nunca inventés datos — usá solo datos reales de las tools o del contexto provisto.
Cuando detectés anomalías (obras vencidas, labores atrasadas, pagos pendientes altos, stock en 0), mencionálo proactivamente aunque no te lo pidan.
Si el usuario saluda o pregunta por el estado general del negocio, usá el contexto de abajo para dar un resumen inteligente sin llamar tools.

IMPORTANTE — identificación de obras: nunca le pidas el ID de una obra al usuario. Si menciona el nombre (completo o parcial), pasalo como obra_nombre en la tool correspondiente — el sistema lo resuelve solo. Si la tool te devuelve "coincidencias" múltiples, mostraselas al usuario y pedile que aclare cuál.

Cuando el usuario pregunte cuánto se gastó, costó o invirtió en una obra, usá consultar_costo_total_obra — esa tool suma materiales usados, mano de obra presupuestada y gastos imprevistos, y te da un desglose completo. No sumes manualmente con otras tools si esta ya existe.

Si ninguna tool disponible te permite responder la pregunta del usuario, llamá a reportar_consulta_no_resuelta con la pregunta exacta y el motivo, y luego explicale honestamente al usuario que no podés responder eso todavía — nunca inventes una respuesta.

${contexto}`;
}



async function ejecutarConversacion(messages, systemPrompt, req, intentos = 0) {
  if (intentos > 6) return 'No pude completar la consulta, probá reformular la pregunta.';

  const promptTokens   = Math.round(systemPrompt.length / 4);
  const messagesTokens = Math.round(JSON.stringify(messages).length / 4);
  const toolsTokens    = Math.round(JSON.stringify(TOOLS).length / 4);
  const total          = promptTokens + messagesTokens + toolsTokens;
  console.log(`[TOKENS] system:${promptTokens} messages:${messagesTokens} tools:${toolsTokens} TOTAL:${total} (intento ${intentos})`);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1536,
    system: systemPrompt,
    tools: TOOLS,
    messages,
  });

  if (response.stop_reason === 'tool_use') {
    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    const toolResults = [];

    for (const toolUse of toolUses) {
      const resultado  = await ejecutarTool(toolUse.name, toolUse.input, req);
      const contenido  = JSON.stringify(resultado);
      const truncado   = contenido.length > 12000
        ? contenido.slice(0, 12000) + '...[truncado]'
        : contenido;
      console.log(`[TOOL] ${toolUse.name} → ${contenido.length} chars → ${truncado.length} enviado`);
      toolResults.push({
        type:        'tool_result',
        tool_use_id: toolUse.id,
        content:     truncado,
      });
    }

    return ejecutarConversacion(
      [...messages, { role: 'assistant', content: response.content }, { role: 'user', content: toolResults }],
      systemPrompt, req, intentos + 1
    );
  }

  return response.content.find((b) => b.type === 'text')?.text ?? 'No obtuve una respuesta.';
}

// ── Endpoints ─────────────────────────────────────────────────
const enviarMensaje = async (req, res) => {
  const rolId = req.user?.rol_id;
  if (!ROLES_ADMIN.includes(rolId) && rolId !== ROL_ADMIN_PRIVADO)
    return res.status(403).json({ success: false, message: 'Sin permiso para usar el asistente' });

  const usuarioId = req.user.userId;
  const { mensaje, sesion_id } = req.body;
  if (!mensaje?.trim())
    return res.status(400).json({ success: false, message: 'El mensaje no puede estar vacío' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let sesionId = sesion_id;
    if (!sesionId) {
      const nueva = await client.query(
        `INSERT INTO asistente_sesiones (usuario_id, titulo) VALUES ($1, $2) RETURNING id`,
        [usuarioId, mensaje.slice(0, 80)]
      );
      sesionId = nueva.rows[0].id;
    } else {
      const existe = await client.query(
        `SELECT id FROM asistente_sesiones WHERE id = $1 AND usuario_id = $2`,
        [sesionId, usuarioId]
      );
      if (existe.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
      }
    }

    await client.query(
      `INSERT INTO asistente_mensajes (sesion_id, rol, contenido) VALUES ($1, 'user', $2)`,
      [sesionId, mensaje]
    );

    const historial = await client.query(
      `SELECT rol, contenido FROM asistente_mensajes WHERE sesion_id = $1 ORDER BY id ASC LIMIT 40`,
      [sesionId]
    );

    await client.query('COMMIT');

    const contexto = await obtenerContextoNegocio(req);
    const systemPrompt = buildSystemPrompt(contexto);
    const messages = historial.rows.map((m) => ({
      role: m.rol === 'user' ? 'user' : 'assistant',
      content: m.contenido,
    }));

    const respuestaFinal = await ejecutarConversacion(messages, systemPrompt, req);

    await pool.query(
      `INSERT INTO asistente_mensajes (sesion_id, rol, contenido) VALUES ($1, 'assistant', $2)`,
      [sesionId, respuestaFinal]
    );
    await pool.query(`UPDATE asistente_sesiones SET updated_at = NOW() WHERE id = $1`, [sesionId]);

    return res.status(200).json({ success: true, data: { sesion_id: sesionId, respuesta: respuestaFinal } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error en asistente IA:', error);
    return res.status(500).json({ success: false, message: 'Error al procesar el mensaje' });
  } finally {
    client.release();
  }
};

const obtenerSesiones = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, titulo, created_at, updated_at FROM asistente_sesiones WHERE usuario_id = $1 ORDER BY updated_at DESC`,
      [req.user.userId]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener sesiones' });
  }
};

const obtenerMensajes = async (req, res) => {
  const { id } = req.params;
  try {
    const sesion = await pool.query(
      `SELECT id FROM asistente_sesiones WHERE id = $1 AND usuario_id = $2`,
      [id, req.user.userId]
    );
    if (sesion.rowCount === 0)
      return res.status(404).json({ success: false, message: 'Sesión no encontrada' });

    const result = await pool.query(
      `SELECT rol, contenido, created_at FROM asistente_mensajes WHERE sesion_id = $1 ORDER BY id ASC`,
      [id]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener mensajes' });
  }
};

const eliminarSesion = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM asistente_sesiones WHERE id = $1 AND usuario_id = $2 RETURNING id`,
      [id, req.user.userId]
    );
    if (result.rowCount === 0)
      return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
    res.status(200).json({ success: true, message: 'Sesión eliminada' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar sesión' });
  }
};

// Endpoint para invalidar cache manualmente (útil tras cambios importantes)
const invalidarCache = (req, res) => {
  contextoCache.delete(getCacheKey(req));
  res.status(200).json({ success: true, message: 'Cache invalidado' });
};

module.exports = { enviarMensaje, obtenerSesiones, obtenerMensajes, eliminarSesion, invalidarCache };