const pool = require('../../connection/db.js');

// Crear un nuevo estado
const crearEstado = async (req, res) => {
  const { nombre, descripcion, ambito } = req.body;

  try {
    const result = await pool.query(`
      INSERT INTO estados (nombre, descripcion, ambito)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [nombre, descripcion, ambito]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al crear estado:', error);
    res.status(500).json({ success: false, error: 'Error al crear el estado' });
  }
};

// Obtener todos los estados
const obtenerEstados = async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM estados ORDER BY id ASC');
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al obtener estados:', error);
    res.status(500).json({ success: false, error: 'Error al obtener los estados' });
  }
};

// Obtener un estado por ID
const obtenerEstadoPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM estados WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Estado no encontrado' });
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener estado:', error);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

// Actualizar un estado
const actualizarEstado = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, ambito } = req.body;

  try {
    // Verificar existencia
    const existe = await pool.query('SELECT * FROM estados WHERE id = $1', [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Estado no encontrado' });
    }

    const result = await pool.query(`
      UPDATE estados
      SET nombre = $1,
          descripcion = $2,
          ambito = $3,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [nombre, descripcion, ambito, id]);

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar el estado' });
  }
};

// Eliminar un estado
const eliminarEstado = async (req, res) => {
  const { id } = req.params;

  try {
    const existe = await pool.query('SELECT * FROM estados WHERE id = $1', [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Estado no encontrado' });
    }

    await pool.query('DELETE FROM estados WHERE id = $1', [id]);

    res.status(200).json({ success: true, mensaje: 'Estado eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar estado:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar el estado' });
  }
};

//Obtener los estados segun ambito

const getEstadosPorAmbito = async (req, res) => {
    try {
        const ambito = req.params
        const result = await pool.query('Select * from estados where ambito = $1 ', [ambito])
        if(result .rows.length === 0){
            return res.status(404).json({ success: false, error: 'No hay estados'})
        }
        res.status(200).json({ success: true, data: result.rows })

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error al obtener los estados'
        })
    }
}

module.exports = {
  crearEstado,
  obtenerEstados,
  obtenerEstadoPorId,
  actualizarEstado,
  eliminarEstado,
  getEstadosPorAmbito
};
