

const pool = require('../../connection/db.js');
const { notificar } = require('../../src/helpers/notificar.js');

// ── Helper: vincular trabajador + su equipo a una obra ────────
const vincularEquipoAObra = async (client, trabajador_id, obra_id, fecha_desde) => {
  await client.query(`
    INSERT INTO trabajadores_obras (trabajador_id, obra_id, fecha_desde)
    VALUES ($1, $2, $3)
    ON CONFLICT (trabajador_id, obra_id) DO NOTHING
  `, [trabajador_id, obra_id, fecha_desde]);

  const equipo = await client.query(`
    SELECT id FROM trabajadores WHERE jefe_id = $1
  `, [trabajador_id]);

  for (const subordinado of equipo.rows) {
    await client.query(`
      INSERT INTO trabajadores_obras (trabajador_id, obra_id, fecha_desde)
      VALUES ($1, $2, $3)
      ON CONFLICT (trabajador_id, obra_id) DO NOTHING
    `, [subordinado.id, obra_id, fecha_desde]);
  }
};

// ── Helper: desvincular trabajador + equipo si no tienen otras labores ──
const desvincularEquipoDeObraIfSinLabores = async (client, trabajador_id, obra_id, excluir_labor_id = null) => {
  const checkQuery = excluir_labor_id
    ? `SELECT id FROM labores WHERE trabajador_id = $1 AND obra_id = $2 AND id != $3 AND estado_id != 2 LIMIT 1`
    : `SELECT id FROM labores WHERE trabajador_id = $1 AND obra_id = $2 AND estado_id != 2 LIMIT 1`;

  const checkParams = excluir_labor_id
    ? [trabajador_id, obra_id, excluir_labor_id]
    : [trabajador_id, obra_id];

  const otrasLabores = await client.query(checkQuery, checkParams);

  if (otrasLabores.rows.length === 0) {
    await client.query(`
      DELETE FROM trabajadores_obras
      WHERE trabajador_id = $1 AND obra_id = $2
    `, [trabajador_id, obra_id]);
  }

  const equipo = await client.query(`
    SELECT id FROM trabajadores WHERE jefe_id = $1
  `, [trabajador_id]);

  for (const subordinado of equipo.rows) {
    const otrasSub = await client.query(
      excluir_labor_id
        ? `SELECT id FROM labores WHERE trabajador_id = $1 AND obra_id = $2 AND id != $3 AND estado_id != 2 LIMIT 1`
        : `SELECT id FROM labores WHERE trabajador_id = $1 AND obra_id = $2 AND estado_id != 2 LIMIT 1`,
      excluir_labor_id
        ? [subordinado.id, obra_id, excluir_labor_id]
        : [subordinado.id, obra_id]
    );

    if (otrasSub.rows.length === 0) {
      await client.query(`
        DELETE FROM trabajadores_obras
        WHERE trabajador_id = $1 AND obra_id = $2
      `, [subordinado.id, obra_id]);
    }
  }
};

// ── Obtener todas las labores ─────────────────────────────────
const obtenerLabores = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        l.*,
        o.nombre AS obra_nombre,
        t.nombre AS trabajador_nombre,
        t.apellido AS trabajador_apellido,
        e.nombre AS especialidad_nombre
      FROM labores l
      LEFT JOIN obras o ON o.id = l.obra_id
      LEFT JOIN trabajadores t ON t.id = l.trabajador_id
      LEFT JOIN especialidades e ON e.id = l.especialidad_id
      ORDER BY l.id
    `);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al obtener labores:', error);
    res.status(500).json({ error: 'Error al obtener las labores' });
  }
};

// ── Obtener mis labores (trabajador logueado) ─────────────────
const obtenerMisLabores = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    // Primero resolver el trabajador_id desde el usuario logueado
    const trabajadorResult = await pool.query(
      `SELECT id FROM trabajadores WHERE usuario_id = $1`,
      [userId]
    );

    if (trabajadorResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró un trabajador asociado a tu usuario'
      });
    }

    const trabajadorId = trabajadorResult.rows[0].id;

    // Buscar labores por campo directo labores.trabajador_id
    // Y también por tabla intermedia labores_trabajadores
    // UNION elimina duplicados si una labor aparece en ambos
    const result = await pool.query(`
      SELECT DISTINCT l.*
      FROM labores l
      WHERE l.trabajador_id = $1

      UNION

      SELECT DISTINCT l.*
      FROM labores l
      JOIN labores_trabajadores lt ON lt.labor_id = l.id
      WHERE lt.trabajador_id = $1

      ORDER BY id ASC
    `, [trabajadorId]);

    return res.status(200).json({ success: true, data: result.rows });

  } catch (error) {
    console.error('Error al obtener mis labores:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener las labores' });
  }
};

// ── Obtener labor por ID ──────────────────────────────────────
const obtenerLaborPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        l.*,
        o.nombre                          AS obra_nombre,
        e.nombre                          AS estado_nombre,
        esp.nombre                        AS especialidad_nombre,
        t.nombre  || ' ' || t.apellido    AS trabajador_nombre,
        t.id                              AS trabajador_id,
        u.nombre                          AS usuario_creador_nombre
      FROM labores l
      LEFT JOIN obras         o   ON o.id   = l.obra_id
      LEFT JOIN estados       e   ON e.id   = l.estado_id
      LEFT JOIN especialidades esp ON esp.id = l.especialidad_id
      LEFT JOIN trabajadores  t   ON t.id   = l.trabajador_id
      LEFT JOIN usuarios      u   ON u.id   = l.usuario_creador_id
      WHERE l.id = $1
    `, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Labor no encontrada' });
    }

    return res.status(200).json({ success: true, data: result.rows[0] });

  } catch (error) {
    console.error('Error al obtener labor:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener la labor' });
  }
};

// ── Crear labor ───────────────────────────────────────────────
const crearLabor = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      obra_id, descripcion, fecha_inicio_estimada, fecha_fin_estimada,
      estado_id, trabajador_id, nombre, especialidad_id, usuario_creador_id
    } = req.body;

    await client.query('BEGIN');

    // 1. Insertar la labor
    const result = await client.query(`
      INSERT INTO labores (
        obra_id, descripcion, fecha_inicio_estimada, fecha_fin_estimada,
        estado_id, trabajador_id, nombre, especialidad_id, usuario_creador_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [obra_id, descripcion, fecha_inicio_estimada, fecha_fin_estimada,
        estado_id, trabajador_id, nombre, especialidad_id, usuario_creador_id]);

    const labor = result.rows[0];

    // 2. Registrar en labores_trabajadores
    if (trabajador_id) {
      await client.query(`
        INSERT INTO labores_trabajadores (labor_id, trabajador_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [labor.id, trabajador_id]);

      // 3. Vincular trabajador + equipo a la obra
      const fechaDesde = fecha_inicio_estimada
        ? fecha_inicio_estimada.split('T')[0]
        : new Date().toISOString().split('T')[0];

      await vincularEquipoAObra(client, trabajador_id, obra_id, fechaDesde);
    }

    await client.query('COMMIT');

    await notificar({
      tipo: 'labor_creada',
      mensaje: `Nueva labor creada: "${nombre}"`,
      usuario_id: null,
    });

    res.status(200).json({ success: true, data: labor });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear labor:', error);
    res.status(500).json({ error: 'Error al crear la labor' });
  } finally {
    client.release();
  }
};

// ── Actualizar labor ──────────────────────────────────────────
const actualizarLabor = async (req, res) => {
  const { id } = req.params;
  const {
    obra_id, descripcion, fecha_inicio_estimada, fecha_fin_estimada,
    estado_id, trabajador_id, nombre, especialidad_id, usuario_creador_id,
    fecha_inicio_real, fecha_fin_real
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener labor actual para comparar
    const laborActual = await client.query(
      `SELECT trabajador_id, obra_id FROM labores WHERE id = $1`,
      [id]
    );

    if (laborActual.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Labor no encontrada' });
    }

    const trabajadorAnterior = laborActual.rows[0].trabajador_id;
    const obraAnterior       = laborActual.rows[0].obra_id;

    // 2. Actualizar la labor
    const result = await client.query(`
      UPDATE labores SET
        obra_id=$1, descripcion=$2,
        fecha_inicio_estimada=$3, fecha_fin_estimada=$4,
        estado_id=$5, trabajador_id=$6, nombre=$7,
        especialidad_id=$8, usuario_creador_id=$9,
        fecha_inicio_real=$10, fecha_fin_real=$11,
        updated_at=NOW()
      WHERE id=$12 RETURNING *
    `, [
      obra_id, descripcion,
      fecha_inicio_estimada || null, fecha_fin_estimada || null,
      estado_id, trabajador_id, nombre,
      especialidad_id, usuario_creador_id,
      fecha_inicio_real || null, fecha_fin_real || null,
      id
    ]);

    // 3. Sincronizar labores_trabajadores
    await client.query(`DELETE FROM labores_trabajadores WHERE labor_id = $1`, [id]);
    if (trabajador_id) {
      await client.query(`
        INSERT INTO labores_trabajadores (labor_id, trabajador_id)
        VALUES ($1, $2) ON CONFLICT DO NOTHING
      `, [id, trabajador_id]);
    }

    // 4. Sincronizar trabajadores_obras si cambió trabajador u obra
    const trabajadorCambio = Number(trabajador_id) !== Number(trabajadorAnterior);
    const obraCambio       = Number(obra_id) !== Number(obraAnterior);

    if (trabajadorCambio || obraCambio) {
      // Desvincular trabajador anterior de obra anterior
      if (trabajadorAnterior) {
        await desvincularEquipoDeObraIfSinLabores(
          client, trabajadorAnterior, obraAnterior, Number(id)
        );
      }
      // Vincular nuevo trabajador a nueva obra
      if (trabajador_id) {
        const fechaDesde = fecha_inicio_estimada
          ? fecha_inicio_estimada.split('T')[0]
          : new Date().toISOString().split('T')[0];
        await vincularEquipoAObra(client, trabajador_id, obra_id, fechaDesde);
      }
    }

    await client.query('COMMIT');

    await notificar({
      tipo: 'labor_modificada',
      mensaje: `Labor #${id} fue modificada`,
      usuario_id: null,
    });

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar labor:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

// ── Dar de baja labor ─────────────────────────────────────────
const darDeBajaLabor = async (req, res) => {
  const { id } = req.params;
  const estado_id = 2;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtener la labor antes de darla de baja
    const labor = await client.query(
      `SELECT * FROM labores WHERE id = $1`,
      [id]
    );

    if (labor.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Labor no encontrada' });
    }

    const { trabajador_id, obra_id } = labor.rows[0];

    // 2. Dar de baja la labor
    await client.query(`
      UPDATE labores SET estado_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [estado_id, id]);

    // 3. Eliminar de labores_trabajadores
    await client.query(`
      DELETE FROM labores_trabajadores WHERE labor_id = $1
    `, [id]);

    // 4. Desvincular trabajador + equipo de la obra
    if (trabajador_id && obra_id) {
      await desvincularEquipoDeObraIfSinLabores(
        client, trabajador_id, obra_id, Number(id)
      );
    }

    await client.query('COMMIT');

    await notificar({
      tipo: 'labor_eliminada',
      mensaje: `Labor #${id} fue dada de baja`,
      usuario_id: null,
    });

    res.status(200).json({
      success: true,
      message: 'Labor dada de baja exitosamente',
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al dar de baja labor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al dar de baja la labor',
    });
  } finally {
    client.release();
  }
};

// ── Cambiar estado labor ──────────────────────────────────────
const cambiarEstadoLabor = async (req, res) => {
  const { id } = req.params;
  const { estado_id } = req.body;
  try {
    const result = await pool.query(`
      UPDATE labores SET estado_id = $1, updated_at = NOW()
      WHERE id = $2 RETURNING *
    `, [estado_id, id]);

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Labor no encontrada' });

    await notificar({
      tipo: 'labor_estado',
      mensaje: `Labor #${id} cambió de estado`,
      usuario_id: null,
    });

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};


// ── Obtener labores por obra ───────────────────────────────────
const obtenerLaboresPorObra = async (req, res) => {
  const { obra_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        l.*,
        e.nombre                       AS estado_nombre,
        esp.nombre                     AS especialidad_nombre,
        t.nombre || ' ' || t.apellido  AS trabajador_nombre
      FROM labores l
      LEFT JOIN estados        e   ON e.id   = l.estado_id
      LEFT JOIN especialidades esp ON esp.id = l.especialidad_id
      LEFT JOIN trabajadores   t   ON t.id   = l.trabajador_id
      WHERE l.obra_id = $1
      ORDER BY l.id ASC
    `, [obra_id]);

    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al obtener labores por obra:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = {
  obtenerLabores,
  obtenerMisLabores,
  obtenerLaborPorId,
  crearLabor,
  actualizarLabor,
  darDeBajaLabor,
  cambiarEstadoLabor,
  obtenerLaboresPorObra
};