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
      WHERE obra_id = $1
      ORDER BY orden ASC, id ASC
    `, [obra_id]);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al obtener sectores:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener sectores' });
  }
};

const crearSector = async (req, res) => {
  try {
    const { obra_id, tipo, valor, orden = 0, parent_id = null } = req.body;
    const propietario_id = req.user.rol_id === ROL_ADMIN_PRIVADO ? req.user.userId : null;

    if (!obra_id || !tipo || !valor) {
      return res.status(400).json({ success: false, message: 'Faltan datos: obra_id, tipo y valor son obligatorios' });
    }
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ success: false, message: `Tipo inválido. Debe ser uno de: ${TIPOS_VALIDOS.join(', ')}` });
    }

    const obraCheck = await pool.query('SELECT id FROM obras WHERE id = $1', [obra_id]);
    if (obraCheck.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'La obra indicada no existe' });
    }

    if (parent_id) {
      const parentCheck = await pool.query(
        'SELECT id FROM sectores WHERE id = $1 AND obra_id = $2', [parent_id, obra_id]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'El sector padre no existe o no pertenece a esta obra' });
      }
    }

    const result = await pool.query(`
      INSERT INTO sectores (obra_id, tipo, valor, orden, parent_id, propietario_id)
      VALUES ($1, $2, $3, $4, $5, $6)
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

  if (!obra_id || !Array.isArray(sectores) || sectores.length === 0) {
    return res.status(400).json({ success: false, message: 'Faltan datos: obra_id y sectores[] son obligatorios' });
  }

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
      const { tipo, valor, orden = 0 } = s;
      if (!TIPOS_VALIDOS.includes(tipo)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Tipo inválido: ${tipo}` });
      }
      const r = await client.query(`
        INSERT INTO sectores (obra_id, tipo, valor, orden, parent_id, propietario_id)
        VALUES ($1, $2, $3, $4, NULL, $5)
        RETURNING *
      `, [obra_id, tipo, valor, orden, propietario_id]);
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
    if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ success: false, message: `Tipo inválido. Debe ser uno de: ${TIPOS_VALIDOS.join(', ')}` });
    }

    const sectorActual = await pool.query('SELECT * FROM sectores WHERE id = $1', [id]);
    if (sectorActual.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sector no encontrado' });
    }

    if (req.user.rol_id === ROL_ADMIN_PRIVADO && sectorActual.rows[0].propietario_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Sin permiso sobre este sector' });
    }

    // Evitar ciclo: parent_id no puede ser el mismo sector ni un descendiente
    if (parent_id && Number(parent_id) === Number(id)) {
      return res.status(400).json({ success: false, message: 'Un sector no puede ser su propio padre' });
    }

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
    const sectorActual = await pool.query('SELECT * FROM sectores WHERE id = $1', [id]);
    if (sectorActual.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sector no encontrado' });
    }

    if (req.user.rol_id === ROL_ADMIN_PRIVADO && sectorActual.rows[0].propietario_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Sin permiso sobre este sector' });
    }

    const hijos = await pool.query(
      `SELECT id FROM sectores WHERE parent_id = $1 LIMIT 1`, [id]
    );
    if (hijos.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar el sector porque tiene sub-sectores asociados. Eliminá los sub-sectores primero.',
      });
    }

    const laboresAsociadas = await pool.query(`
      SELECT id FROM labores
      WHERE sector_id = $1
        AND (estado_id IS NULL OR estado_id != 2)
      LIMIT 1
    `, [id]);
    if (laboresAsociadas.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar el sector porque tiene labores asociadas. Reasigná o eliminá las labores primero.',
      });
    }

    await pool.query('DELETE FROM sectores WHERE id = $1', [id]);
    return res.status(200).json({ success: true, message: 'Sector eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar sector:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar sector' });
  }
};

module.exports = {
  obtenerSectoresPorObra,
  crearSector,
  crearSectoresBulk,
  actualizarSector,
  eliminarSector,
};