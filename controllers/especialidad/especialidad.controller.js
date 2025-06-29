const pool = require('../../connection/db.js');
require('dotenv').config();

// Crear una nueva especialidad
const crearEspecialidad = async (req, res) => {
    try {
        const { nombre, descripcion, estado_id } = req.body;
    
        if (!nombre || !descripcion || !estado_id) {
            console.log('Datos incompletos para crear especialidad:', req.body);
        return res.status(400).json({ error: 'Faltan nombre o descripción de la especialidad' });
        }

        const estadoResult = await pool.query('SELECT * FROM estados WHERE id = $1', [estado_id]);
        if (estadoResult.rows.length === 0) {
            return res.status(400).json({ error: 'Estado no válido' });
        }
    
        // Verificar si ya existe una especialidad con ese nombre
        const nombreLower = nombre.toLowerCase();

        const existente = await pool.query('SELECT * FROM especialidades WHERE nombre = $1', [nombreLower]);
        if (existente.rows.length > 0) {
        return res.status(400).json({ message: 'La especialidad ya existe' });
        }

     
        // Crear la nueva especialidad
        const result = await pool.query(`
        INSERT INTO especialidades (nombre, descripcion, estado_id)
        VALUES ($1, $2, $3)
        RETURNING id, nombre, descripcion, estado_id
        `, [nombreLower, descripcion, estado_id]);

        const nuevaEspecialidad = result.rows[0];

        const estado = await pool.query('SELECT * FROM estados WHERE id = $1', [estado_id]);
        nuevaEspecialidad.estado = estado.rows[0];
    
       return res.status(201).json({
          id: nuevaEspecialidad.id,
          nombre: nuevaEspecialidad.nombre,
          descripcion: nuevaEspecialidad.descripcion,
          estado: estadoResult.rows[0].nombre,
          message: 'Especialidad creada correctamente'
        });
    
    } catch (error) {
        console.error('Error al crear especialidad:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}


// Modificar una especialidad
const modificarEspecialidad = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, estado_id } = req.body;

  console.log('Datos recibidos para modificar especialidad:', {
    id,
    nombre,
    descripcion
  });

  try {
    // Verificar que la especialidad existe
    const especialidadExistente = await pool.query(
      'SELECT * FROM especialidades WHERE id = $1',
      [id]
    );

    if (especialidadExistente.rows.length === 0) {
      return res.status(404).json({ error: 'Especialidad no encontrada' });
    }

    // validar que el estado_id sea válido
    if (estado_id) {
      const estadoResult = await pool.query(
        'SELECT * FROM estados WHERE id = $1',
        [estado_id]
      );
      if (estadoResult.rows.length === 0) {
        return res.status(400).json({ error: 'Estado no válido' });
      }
    }

    // Validar que haya datos en el body
    if (!nombre || !descripcion) {
      return res
        .status(400)
        .json({ error: 'Faltan nombre o descripción de la especialidad' });
    }

    // Actualizar la especialidad
    const result = await pool.query(
      `
      UPDATE especialidades
      SET nombre = $1,
          descripcion = $2,
          estado_id = $3
      WHERE id = $4
      RETURNING id, nombre, estado_id, descripcion
      `,
      [nombre, descripcion, estado_id, id]
    );

    return res.status(200).json({
      especialidad: result.rows[0],
      message: 'Especialidad modificada correctamente',
    });
  } catch (error) {
    console.error('Error al modificar especialidad:', error);

    // Capturamos violación de clave única si se nos escapó
    if (error.code === '23505') {
      return res
        .status(400)
        .json({ error: 'El nombre de especialidad ya existe.' });
    }

    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener todas las especialidades
const obtenerEspecialidades = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM especialidades');
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener especialidades:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

//delete especialidad
const eliminarEspecialidad = async (req, res) => {
    const { id } = req.params;
    const estado_id = 2; 
    try {
        // Verificar que la especialidad existe
        const especialidadExistente = await pool.query('SELECT * FROM especialidades WHERE id = $1', [id]);
        if (especialidadExistente.rows.length === 0) {
            return res.status(404).json({ error: 'Especialidad no encontrada' });
        }
        
        

        // Actualizar el estado de la especialidad a "eliminada"
        await pool.query('UPDATE especialidades SET estado_id = $1 WHERE id = $2', [estado_id, id]);


        
        return res.status(200).json({ message: 'Especialidad modificada a estado inactivo' });
        
    } catch (error) {
        console.error('Error al eliminar especialidad:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

module.exports = {
    crearEspecialidad,
    modificarEspecialidad,
    obtenerEspecialidades,
    eliminarEspecialidad
};

