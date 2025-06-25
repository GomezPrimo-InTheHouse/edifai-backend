const pool = require('../../connection/db.js');
require('dotenv').config();

const crearEspecialidad = async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;
    
        if (!nombre || !descripcion) {
        return res.status(400).json({ error: 'Faltan nombre o descripción de la especialidad' });
        }
    
        // Verificar si ya existe una especialidad con ese nombre
        const nombreLower = nombre.toLowerCase();

        const existente = await pool.query('SELECT * FROM especialidades WHERE nombre = $1', [nombreLower]);
        if (existente.rows.length > 0) {
        return res.status(400).json({ message: 'La especialidad ya existe' });
        }

        // pasar nombre a minúsculas
    
        // Crear la nueva especialidad
        const result = await pool.query(`
        INSERT INTO especialidades (nombre, descripcion)
        VALUES ($1, $2)
        RETURNING id, nombre, descripcion
        `, [nombreLower, descripcion]);
    
        return res.status(201).json({
        especialidad: result.rows[0],
        message: 'Especialidad creada correctamente'
        });
    
    } catch (error) {
        console.error('Error al crear especialidad:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
    }

const modificarEspecialidad = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;

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

    // Validar que haya datos en el body
    if (!nombre || !descripcion) {
      return res
        .status(400)
        .json({ error: 'Faltan nombre o descripción de la especialidad' });
    }

    // Verificar que no exista otra especialidad con el mismo nombre
    // const nombreDuplicado = await pool.query(
    //   'SELECT 1 FROM especialidades WHERE nombre = $1 AND id <> $2',
    //   [nombre, id]
    // );

    // if (nombreDuplicado.rows.length > 0) {
    //   return res
    //     .status(400)
    //     .json({ error: 'Ya existe una especialidad con ese nombre.' });
    // }

    // Actualizar la especialidad
    const result = await pool.query(
      `
      UPDATE especialidades
      SET nombre = $1,
          descripcion = $2
      WHERE id = $3
      RETURNING id, nombre, descripcion
      `,
      [nombre, descripcion, id]
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
    
    try {
        // Verificar que la especialidad existe
        const especialidadExistente = await pool.query('SELECT * FROM especialidades WHERE id = $1', [id]);
        if (especialidadExistente.rows.length === 0) {
            return res.status(404).json({ error: 'Especialidad no encontrada' });
        }
        
        // Eliminar la especialidad
        await pool.query('DELETE FROM especialidades WHERE id = $1', [id]);
        
        return res.status(200).json({ message: 'Especialidad eliminada correctamente' });
        
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

