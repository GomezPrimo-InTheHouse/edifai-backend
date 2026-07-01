// const pool = require('../../connection/db.js');
// const { ROL_ADMIN_PRIVADO } = require('../../middlewares/filtrarPorPropietario.js');

// const TIPOS_VALIDOS = [
//   'complejo', 'edificio', 'ala', 'piso',
//   'modulo', 'unidad', 'ambiente', 'sector', 'otro',
// ];

// const obtenerSectoresPorObra = async (req, res) => {
//   const { obra_id } = req.params;
//   try {
//     const result = await pool.query(`
//       SELECT * FROM sectores
//       WHERE obra_id = $1
//       ORDER BY orden ASC, id ASC
//     `, [obra_id]);
//     return res.status(200).json({ success: true, data: result.rows });
//   } catch (error) {
//     console.error('Error al obtener sectores:', error);
//     return res.status(500).json({ success: false, message: 'Error al obtener sectores' });
//   }
// };

// const crearSector = async (req, res) => {
//   try {
//     const { obra_id, tipo, valor, orden = 0, parent_id = null } = req.body;
//     const propietario_id = req.user.rol_id === ROL_ADMIN_PRIVADO ? req.user.userId : null;

//     if (!obra_id || !tipo || !valor) {
//       return res.status(400).json({ success: false, message: 'Faltan datos: obra_id, tipo y valor son obligatorios' });
//     }
//     if (!TIPOS_VALIDOS.includes(tipo)) {
//       return res.status(400).json({ success: false, message: `Tipo inválido. Debe ser uno de: ${TIPOS_VALIDOS.join(', ')}` });
//     }

//     const obraCheck = await pool.query('SELECT id FROM obras WHERE id = $1', [obra_id]);
//     if (obraCheck.rows.length === 0) {
//       return res.status(400).json({ success: false, message: 'La obra indicada no existe' });
//     }

//     if (parent_id) {
//       const parentCheck = await pool.query(
//         'SELECT id FROM sectores WHERE id = $1 AND obra_id = $2', [parent_id, obra_id]
//       );
//       if (parentCheck.rows.length === 0) {
//         return res.status(400).json({ success: false, message: 'El sector padre no existe o no pertenece a esta obra' });
//       }
//     }

//     const result = await pool.query(`
//       INSERT INTO sectores (obra_id, tipo, valor, orden, parent_id, propietario_id)
//       VALUES ($1, $2, $3, $4, $5, $6)
//       RETURNING *
//     `, [obra_id, tipo, valor, orden, parent_id, propietario_id]);

//     return res.status(200).json({ success: true, data: result.rows[0] });
//   } catch (error) {
//     console.error('Error al crear sector:', error);
//     return res.status(500).json({ success: false, message: 'Error al crear sector' });
//   }
// };

// const crearSectoresBulk = async (req, res) => {
//   const { obra_id, sectores } = req.body;
//   const propietario_id = req.user.rol_id === ROL_ADMIN_PRIVADO ? req.user.userId : null;

//   if (!obra_id || !Array.isArray(sectores) || sectores.length === 0) {
//     return res.status(400).json({ success: false, message: 'Faltan datos: obra_id y sectores[] son obligatorios' });
//   }

//   const client = await pool.connect();
//   try {
//     await client.query('BEGIN');

//     const obraCheck = await client.query('SELECT id FROM obras WHERE id = $1', [obra_id]);
//     if (obraCheck.rows.length === 0) {
//       await client.query('ROLLBACK');
//       return res.status(400).json({ success: false, message: 'La obra indicada no existe' });
//     }

//     const insertados = [];
//     for (const s of sectores) {
//       const { tipo, valor, orden = 0 } = s;
//       if (!TIPOS_VALIDOS.includes(tipo)) {
//         await client.query('ROLLBACK');
//         return res.status(400).json({ success: false, message: `Tipo inválido: ${tipo}` });
//       }
//       const r = await client.query(`
//         INSERT INTO sectores (obra_id, tipo, valor, orden, parent_id, propietario_id)
//         VALUES ($1, $2, $3, $4, NULL, $5)
//         RETURNING *
//       `, [obra_id, tipo, valor, orden, propietario_id]);
//       insertados.push(r.rows[0]);
//     }

//     await client.query('COMMIT');
//     return res.status(200).json({ success: true, data: insertados });
//   } catch (error) {
//     await client.query('ROLLBACK');
//     console.error('Error al crear sectores en bulk:', error);
//     return res.status(500).json({ success: false, message: 'Error al crear sectores' });
//   } finally {
//     client.release();
//   }
// };

// const actualizarSector = async (req, res) => {
//   const { id } = req.params;
//   const { tipo, valor, orden, parent_id } = req.body;

//   try {
//     if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
//       return res.status(400).json({ success: false, message: `Tipo inválido. Debe ser uno de: ${TIPOS_VALIDOS.join(', ')}` });
//     }

//     const sectorActual = await pool.query('SELECT * FROM sectores WHERE id = $1', [id]);
//     if (sectorActual.rows.length === 0) {
//       return res.status(404).json({ success: false, message: 'Sector no encontrado' });
//     }

//     if (req.user.rol_id === ROL_ADMIN_PRIVADO && sectorActual.rows[0].propietario_id !== req.user.userId) {
//       return res.status(403).json({ success: false, message: 'Sin permiso sobre este sector' });
//     }

//     // Evitar ciclo: parent_id no puede ser el mismo sector ni un descendiente
//     if (parent_id && Number(parent_id) === Number(id)) {
//       return res.status(400).json({ success: false, message: 'Un sector no puede ser su propio padre' });
//     }

//     const result = await pool.query(`
//       UPDATE sectores SET
//         tipo      = COALESCE($1, tipo),
//         valor     = COALESCE($2, valor),
//         orden     = COALESCE($3, orden),
//         parent_id = $4
//       WHERE id = $5
//       RETURNING *
//     `, [tipo ?? null, valor ?? null, orden ?? null, parent_id ?? null, id]);

//     return res.status(200).json({ success: true, data: result.rows[0] });
//   } catch (error) {
//     console.error('Error al actualizar sector:', error);
//     return res.status(500).json({ success: false, message: 'Error al actualizar sector' });
//   }
// };

// const eliminarSector = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const sectorActual = await pool.query('SELECT * FROM sectores WHERE id = $1', [id]);
//     if (sectorActual.rows.length === 0) {
//       return res.status(404).json({ success: false, message: 'Sector no encontrado' });
//     }

//     if (req.user.rol_id === ROL_ADMIN_PRIVADO && sectorActual.rows[0].propietario_id !== req.user.userId) {
//       return res.status(403).json({ success: false, message: 'Sin permiso sobre este sector' });
//     }

//     const hijos = await pool.query(
//       `SELECT id FROM sectores WHERE parent_id = $1 LIMIT 1`, [id]
//     );
//     if (hijos.rows.length > 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No se puede eliminar el sector porque tiene sub-sectores asociados. Eliminá los sub-sectores primero.',
//       });
//     }

//     const laboresAsociadas = await pool.query(`
//       SELECT id FROM labores
//       WHERE sector_id = $1
//         AND (estado_id IS NULL OR estado_id != 2)
//       LIMIT 1
//     `, [id]);
//     if (laboresAsociadas.rows.length > 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No se puede eliminar el sector porque tiene labores asociadas. Reasigná o eliminá las labores primero.',
//       });
//     }

//     await pool.query('DELETE FROM sectores WHERE id = $1', [id]);
//     return res.status(200).json({ success: true, message: 'Sector eliminado correctamente' });
//   } catch (error) {
//     console.error('Error al eliminar sector:', error);
//     return res.status(500).json({ success: false, message: 'Error al eliminar sector' });
//   }
// };

// module.exports = {
//   obtenerSectoresPorObra,
//   crearSector,
//   crearSectoresBulk,
//   actualizarSector,
//   eliminarSector,
// };

const pool = require('../../connection/db.js');
const { ROL_ADMIN_PRIVADO } = require('../../middlewares/filtrarPorPropietario.js');

const TIPOS_VALIDOS = [
  'complejo', 'edificio', 'ala', 'piso',
  'modulo', 'unidad', 'ambiente', 'sector', 'otro',
];

const obtenerSectoresPorObra = async (req, res) => {
  const { obra_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT * FROM sectores
      WHERE obra_id = $1 AND activo = TRUE
      ORDER BY orden ASC, id ASC
    `, [obra_id]);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al obtener sectores:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener sectores' });
  }
};

const obtenerSectoresConStats = async (req, res) => {
  const { obra_id } = req.params;
  try {
    const result = await pool.query(`
      WITH RECURSIVE sector_tree AS (
        SELECT id, obra_id, tipo, valor, orden, parent_id, activo, propietario_id, created_at
        FROM sectores
        WHERE obra_id = $1 AND activo = TRUE
      ),
      descendant_map AS (
        SELECT id AS ancestor_id, id AS descendant_id FROM sector_tree
        UNION ALL
        SELECT dm.ancestor_id, st.id
        FROM descendant_map dm
        JOIN sector_tree st ON st.parent_id = dm.descendant_id
      )
      SELECT
        s.id, s.obra_id, s.tipo, s.valor, s.orden, s.parent_id, s.activo,
        CAST(COALESCE(COUNT(DISTINCT l.id), 0) AS INTEGER) AS labor_count
      FROM sector_tree s
      LEFT JOIN descendant_map dm ON dm.ancestor_id = s.id
      LEFT JOIN labores l ON l.sector_id = dm.descendant_id
        AND l.archivado = FALSE
        AND (l.estado_id IS NULL OR l.estado_id != 2)
      GROUP BY s.id, s.obra_id, s.tipo, s.valor, s.orden, s.parent_id, s.activo
      ORDER BY s.orden ASC, s.id ASC
    `, [obra_id]);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al obtener sectores con stats:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener sectores' });
  }
};

const crearSector = async (req, res) => {
  try {
    const { obra_id, tipo, valor, orden = 0, parent_id = null } = req.body;
    const propietario_id = req.user.rol_id === ROL_ADMIN_PRIVADO ? req.user.userId : null;

    if (!obra_id || !tipo || !valor)
      return res.status(400).json({ success: false, message: 'Faltan datos: obra_id, tipo y valor son obligatorios' });
    if (!TIPOS_VALIDOS.includes(tipo))
      return res.status(400).json({ success: false, message: `Tipo inválido. Debe ser uno de: ${TIPOS_VALIDOS.join(', ')}` });

    const obraCheck = await pool.query('SELECT id FROM obras WHERE id = $1', [obra_id]);
    if (obraCheck.rows.length === 0)
      return res.status(400).json({ success: false, message: 'La obra indicada no existe' });

    if (parent_id) {
      const parentCheck = await pool.query(
        'SELECT id FROM sectores WHERE id = $1 AND obra_id = $2 AND activo = TRUE', [parent_id, obra_id]
      );
      if (parentCheck.rows.length === 0)
        return res.status(400).json({ success: false, message: 'El sector padre no existe o no pertenece a esta obra' });
    }

    const result = await pool.query(`
      INSERT INTO sectores (obra_id, tipo, valor, orden, parent_id, propietario_id, activo)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING *
    `, [obra_id, tipo, valor, orden, parent_id, propietario_id]);

    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al crear sector:', error);
    return res.status(500).json({ success: false, message: 'Error al crear sector' });
  }
};

const crearSectoresBulk = async (req, res) => {
  const { obra_id, sectores } = req.body;
  const propietario_id = req.user.rol_id === ROL_ADMIN_PRIVADO ? req.user.userId : null;

  if (!obra_id || !Array.isArray(sectores) || sectores.length === 0)
    return res.status(400).json({ success: false, message: 'Faltan datos: obra_id y sectores[] son obligatorios' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const obraCheck = await client.query('SELECT id FROM obras WHERE id = $1', [obra_id]);
    if (obraCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'La obra indicada no existe' });
    }

    const insertados = [];
    for (const s of sectores) {
      const { tipo, valor, orden = 0, parent_id = null } = s;
      if (!TIPOS_VALIDOS.includes(tipo)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Tipo inválido: ${tipo}` });
      }
      const r = await client.query(`
        INSERT INTO sectores (obra_id, tipo, valor, orden, parent_id, propietario_id, activo)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        RETURNING *
      `, [obra_id, tipo, valor, orden, parent_id, propietario_id]);
      insertados.push(r.rows[0]);
    }

    await client.query('COMMIT');
    return res.status(200).json({ success: true, data: insertados });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear sectores en bulk:', error);
    return res.status(500).json({ success: false, message: 'Error al crear sectores' });
  } finally {
    client.release();
  }
};

const actualizarSector = async (req, res) => {
  const { id } = req.params;
  const { tipo, valor, orden, parent_id } = req.body;

  try {
    if (tipo && !TIPOS_VALIDOS.includes(tipo))
      return res.status(400).json({ success: false, message: 'Tipo inválido' });

    const sectorActual = await pool.query('SELECT * FROM sectores WHERE id = $1 AND activo = TRUE', [id]);
    if (sectorActual.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Sector no encontrado' });

    if (req.user.rol_id === ROL_ADMIN_PRIVADO && sectorActual.rows[0].propietario_id !== req.user.userId)
      return res.status(403).json({ success: false, message: 'Sin permiso sobre este sector' });

    if (parent_id && Number(parent_id) === Number(id))
      return res.status(400).json({ success: false, message: 'Un sector no puede ser su propio padre' });

    const result = await pool.query(`
      UPDATE sectores SET
        tipo      = COALESCE($1, tipo),
        valor     = COALESCE($2, valor),
        orden     = COALESCE($3, orden),
        parent_id = $4
      WHERE id = $5
      RETURNING *
    `, [tipo ?? null, valor ?? null, orden ?? null, parent_id ?? null, id]);

    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar sector:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar sector' });
  }
};

const eliminarSector = async (req, res) => {
  const { id } = req.params;

  try {
    const sectorActual = await pool.query('SELECT * FROM sectores WHERE id = $1 AND activo = TRUE', [id]);
    if (sectorActual.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Sector no encontrado' });

    if (req.user.rol_id === ROL_ADMIN_PRIVADO && sectorActual.rows[0].propietario_id !== req.user.userId)
      return res.status(403).json({ success: false, message: 'Sin permiso sobre este sector' });

    // Obtener self + todos los descendientes
    const descendantsResult = await pool.query(`
      WITH RECURSIVE descendants AS (
        SELECT id, tipo, valor FROM sectores WHERE id = $1 AND activo = TRUE
        UNION ALL
        SELECT s.id, s.tipo, s.valor FROM sectores s
        JOIN descendants d ON s.parent_id = d.id WHERE s.activo = TRUE
      )
      SELECT id, tipo, valor FROM descendants
    `, [id]);

    const allIds = descendantsResult.rows.map(r => r.id);

    // Verificar labores activas en cualquier sector afectado
    const laboresCheck = await pool.query(`
      SELECT s.tipo, s.valor
      FROM labores l
      JOIN sectores s ON s.id = l.sector_id
      WHERE l.sector_id = ANY($1::int[])
        AND l.archivado = FALSE
        AND (l.estado_id IS NULL OR l.estado_id != 2)
      LIMIT 1
    `, [allIds]);

    if (laboresCheck.rows.length > 0) {
      const s = laboresCheck.rows[0];
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar: el sector "${s.tipo} ${s.valor}" tiene labores activas. Reasigná o eliminá las labores primero.`,
      });
    }

    await pool.query(`UPDATE sectores SET activo = FALSE WHERE id = ANY($1::int[])`, [allIds]);

    return res.status(200).json({
      success: true,
      message: allIds.length > 1
        ? `${allIds.length} sectores eliminados correctamente`
        : 'Sector eliminado correctamente',
    });
  } catch (error) {
    console.error('Error al eliminar sector:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar sector' });
  }
};

module.exports = {
  obtenerSectoresPorObra,
  obtenerSectoresConStats,
  crearSector,
  crearSectoresBulk,
  actualizarSector,
  eliminarSector,
};