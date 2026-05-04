const pool = require('../../connection/db.js');
const { notificar } = require('../../src/helpers/notificar.js');

// GET /presentismo/mis-obras
const getMisObras = async (req, res) => {
  const userId = req.user.userId;

  try {
    const trabajadorResult = await pool.query(
      `SELECT id, nombre, apellido FROM trabajadores WHERE usuario_id = $1`,
      [userId]
    );

    if (trabajadorResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró un trabajador vinculado a este usuario',
      });
    }

    const trabajador = trabajadorResult.rows[0];

    const obrasResult = await pool.query(
      `SELECT DISTINCT
         o.id, o.nombre, o.ubicacion, o.latitud, o.longitud, o.estado_id,
         to2.nombre AS tipo_obra_nombre,
         tob.fecha_desde, tob.fecha_hasta, tob.rol_en_obra
       FROM obras o
       JOIN trabajadores_obras tob ON tob.obra_id = o.id
       LEFT JOIN tipos_de_obra to2 ON to2.id = o.tipo_obra_id
       WHERE tob.trabajador_id = $1
         AND (tob.fecha_hasta IS NULL OR tob.fecha_hasta >= CURRENT_DATE)
       ORDER BY o.nombre`,
      [trabajador.id]
    );

    res.json({ success: true, trabajador, data: obrasResult.rows });
  } catch (error) {
    console.error('Error en getMisObras:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// POST /presentismo/marcar
const marcarPresentismo = async (req, res) => {
  const userId = req.user.userId;
  const { obra_id, latitud, longitud, observaciones } = req.body;

  if (!obra_id || latitud == null || longitud == null) {
    return res.status(400).json({
      success: false,
      message: 'Faltan campos obligatorios: obra_id, latitud, longitud',
    });
  }

  try {
    const trabajadorResult = await pool.query(
      `SELECT id, nombre, apellido FROM trabajadores WHERE usuario_id = $1`,
      [userId]
    );

    if (trabajadorResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró un trabajador vinculado a este usuario',
      });
    }

    const trabajador = trabajadorResult.rows[0];

    // Verificar vinculación activa con la obra
    const vinculacion = await pool.query(
      `SELECT id FROM trabajadores_obras
       WHERE trabajador_id = $1
         AND obra_id = $2
         AND (fecha_hasta IS NULL OR fecha_hasta >= CURRENT_DATE)`,
      [trabajador.id, obra_id]
    );

    if (vinculacion.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'No tenés vinculación activa con esta obra',
      });
    }

    const result = await pool.query(
      `INSERT INTO presentismos (trabajador_id, obra_id, fecha, latitud, longitud, observaciones)
       VALUES ($1, $2, NOW(), $3, $4, $5)
       RETURNING *`,
      [trabajador.id, obra_id, latitud, longitud, observaciones ?? null]
    );

    await notificar({
      tipo: 'presentismo',
      mensaje: `${trabajador.nombre} ${trabajador.apellido} marcó presentismo`,
      usuario_id: userId, // personal del trabajador + admins
    });

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error en marcarPresentismo:', error.message);
    notificar({
      tipo: 'error_sistema',
      mensaje: `Error al marcar presentismo: ${error.message}`,
      usuario_id: null,
    });
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// GET /presentismo/historial
const getHistorial = async (req, res) => {
  const userId = req.user.userId;

  try {
    const trabajadorResult = await pool.query(
      `SELECT id FROM trabajadores WHERE usuario_id = $1`,
      [userId]
    );

    if (trabajadorResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Trabajador no encontrado' });
    }

    const trabajadorId = trabajadorResult.rows[0].id;

    const result = await pool.query(
      `SELECT p.*, o.nombre AS obra_nombre
       FROM presentismos p
       LEFT JOIN obras o ON o.id = p.obra_id
       WHERE p.trabajador_id = $1
       ORDER BY p.fecha DESC
       LIMIT 50`,
      [trabajadorId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error en getHistorial:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// GET /presentismo/historial-admin
// const getHistorialAdmin = async (req, res) => {
//   const { obra_id, trabajador_id, fecha } = req.query;

//   try {
//     let query = `
//       SELECT p.*,
//              o.nombre  AS obra_nombre,
//              t.nombre  AS trabajador_nombre,
//              t.apellido AS trabajador_apellido
//       FROM presentismos p
//       LEFT JOIN obras o ON o.id = p.obra_id
//       LEFT JOIN trabajadores t ON t.id = p.trabajador_id
//       WHERE 1=1
//     `;
//     const values = [];
//     let idx = 1;

//     if (obra_id)       { query += ` AND p.obra_id = $${idx++}`;        values.push(obra_id); }
//     if (trabajador_id) { query += ` AND p.trabajador_id = $${idx++}`;  values.push(trabajador_id); }
//     if (fecha)         { query += ` AND DATE(p.fecha) = $${idx++}`;    values.push(fecha); }

//     query += ` ORDER BY p.fecha DESC LIMIT 100`;

//     const result = await pool.query(query, values);
//     res.json({ success: true, data: result.rows });
//   } catch (error) {
//     console.error('Error en getHistorialAdmin:', error.message);
//     res.status(500).json({ success: false, message: 'Error interno del servidor' });
//   }
// };

// ── GET /presentismo/estadisticas ─────────────────────────────
const getEstadisticas = async (req, res) => {
  const { fecha_desde, fecha_hasta, obra_id } = req.query;

  const desde = fecha_desde || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const hasta = fecha_hasta || new Date().toISOString().split('T')[0];

  try {
    // 1. Resumen general
    const resumenResult = await pool.query(`
      SELECT
        COUNT(*)                          AS total_registros,
        COUNT(DISTINCT trabajador_id)     AS trabajadores_activos,
        COUNT(DISTINCT obra_id)           AS obras_con_actividad,
        COUNT(DISTINCT DATE(fecha))       AS dias_con_actividad
      FROM presentismos
      WHERE DATE(fecha) BETWEEN $1 AND $2
        ${obra_id ? 'AND obra_id = $3' : ''}
    `, obra_id ? [desde, hasta, obra_id] : [desde, hasta]);

    // 2. Ranking trabajadores más cumplidores
    const rankingResult = await pool.query(`
      SELECT
        t.id            AS trabajador_id,
        t.nombre,
        t.apellido,
        COUNT(p.id)     AS total_registros,
        COUNT(DISTINCT DATE(p.fecha)) AS dias_distintos,
        MIN(p.fecha::time)            AS hora_promedio_entrada,
        MAX(DATE(p.fecha))            AS ultimo_registro
      FROM presentismos p
      JOIN trabajadores t ON t.id = p.trabajador_id
      WHERE DATE(p.fecha) BETWEEN $1 AND $2
        ${obra_id ? 'AND p.obra_id = $3' : ''}
      GROUP BY t.id, t.nombre, t.apellido
      ORDER BY dias_distintos DESC, total_registros DESC
      LIMIT 10
    `, obra_id ? [desde, hasta, obra_id] : [desde, hasta]);

    // 3. Ausentes hoy
    const ausentesResult = await pool.query(`
      SELECT DISTINCT
        t.id, t.nombre, t.apellido, o.nombre AS obra_nombre
      FROM trabajadores_obras tob
      JOIN trabajadores t ON t.id = tob.trabajador_id
      JOIN obras o ON o.id = tob.obra_id
      WHERE (tob.fecha_hasta IS NULL OR tob.fecha_hasta >= CURRENT_DATE)
        AND t.id NOT IN (
          SELECT DISTINCT trabajador_id
          FROM presentismos
          WHERE DATE(fecha) = CURRENT_DATE
        )
        ${obra_id ? 'AND tob.obra_id = $1' : ''}
      ORDER BY t.apellido
    `, obra_id ? [obra_id] : []);

    // 4. Registros por día de la semana
    const porDiaResult = await pool.query(`
      SELECT
        EXTRACT(DOW FROM fecha) AS dia_semana,
        TO_CHAR(fecha, 'Day')   AS nombre_dia,
        COUNT(*)                AS total
      FROM presentismos
      WHERE DATE(fecha) BETWEEN $1 AND $2
        ${obra_id ? 'AND obra_id = $3' : ''}
      GROUP BY dia_semana, nombre_dia
      ORDER BY dia_semana
    `, obra_id ? [desde, hasta, obra_id] : [desde, hasta]);

    // 5. Asistencia por obra
    const porObraResult = await pool.query(`
      SELECT
        o.id            AS obra_id,
        o.nombre        AS obra_nombre,
        COUNT(p.id)     AS total_registros,
        COUNT(DISTINCT p.trabajador_id) AS trabajadores_distintos,
        COUNT(DISTINCT DATE(p.fecha))   AS dias_con_actividad
      FROM presentismos p
      JOIN obras o ON o.id = p.obra_id
      WHERE DATE(p.fecha) BETWEEN $1 AND $2
      GROUP BY o.id, o.nombre
      ORDER BY total_registros DESC
    `, [desde, hasta]);

    // 6. Trabajadores con asistencia todos los días del período
    const diasPeriodo = Math.ceil(
      (new Date(hasta) - new Date(desde)) / (1000 * 60 * 60 * 24)
    ) + 1;

    const perfectosResult = await pool.query(`
      SELECT
        t.id, t.nombre, t.apellido,
        COUNT(DISTINCT DATE(p.fecha)) AS dias_asistidos
      FROM presentismos p
      JOIN trabajadores t ON t.id = p.trabajador_id
      WHERE DATE(p.fecha) BETWEEN $1 AND $2
        ${obra_id ? 'AND p.obra_id = $3' : ''}
      GROUP BY t.id, t.nombre, t.apellido
      HAVING COUNT(DISTINCT DATE(p.fecha)) >= $${obra_id ? 4 : 3}
      ORDER BY dias_asistidos DESC
    `, obra_id ? [desde, hasta, obra_id, diasPeriodo] : [desde, hasta, diasPeriodo]);

    res.json({
      success: true,
      data: {
        periodo:          { desde, hasta },
        resumen:          resumenResult.rows[0],
        ranking:          rankingResult.rows,
        ausentes_hoy:     ausentesResult.rows,
        por_dia_semana:   porDiaResult.rows,
        por_obra:         porObraResult.rows,
        asistencia_perfecta: perfectosResult.rows,
        dias_periodo:     diasPeriodo,
      },
    });
  } catch (error) {
    console.error('Error en getEstadisticas:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// ── GET /presentismo/historial-admin ─────────────────────────
const getHistorialAdmin = async (req, res) => {
  const { obra_id, trabajador_id, fecha } = req.query;

  try {
    let query = `
      SELECT p.*,
             o.nombre  AS obra_nombre,
             t.nombre  AS trabajador_nombre,
             t.apellido AS trabajador_apellido
      FROM presentismos p
      LEFT JOIN obras o ON o.id = p.obra_id
      LEFT JOIN trabajadores t ON t.id = p.trabajador_id
      WHERE 1=1
    `;
    const values = [];
    let idx = 1;

    if (obra_id)       { query += ` AND p.obra_id = $${idx++}`;       values.push(obra_id); }
    if (trabajador_id) { query += ` AND p.trabajador_id = $${idx++}`; values.push(trabajador_id); }
    if (fecha)         { query += ` AND DATE(p.fecha) = $${idx++}`;   values.push(fecha); }

    query += ` ORDER BY p.fecha DESC LIMIT 200`;

    const result = await pool.query(query, values);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error en getHistorialAdmin:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = { getMisObras, marcarPresentismo, getHistorial, getHistorialAdmin, getEstadisticas };