const pool = require('../../../connection/db.js');
require('dotenv').config();


//table estados
// Table roles {
//   id serial [pk, not null]
//   nombre varchar(50) 
//   descripcion text
//   created_at timestamp [default: `now()`]
//   updated_at timestamp [default: `now()`]
// }

//crear nuevo rol
const crearRol = async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;
    
        if (!nombre || !descripcion) {
        return res.status(400).json({ error: 'Faltan nombre o descripción del rol' });
        }
    
        // Verificar si ya existe un rol con ese nombre
        const existente = await pool.query('SELECT * FROM roles WHERE nombre = $1', [nombre]);
        if (existente.rows.length > 0) {
        return res.status(400).json({ message: 'El rol ya existe' });
        }
    
        // Crear el nuevo rol
        const result = await pool.query(`
        INSERT INTO roles (nombre, descripcion, created_at)
        VALUES ($1, $2, NOW())
        RETURNING id, nombre, descripcion, created_at
        `, [nombre, descripcion]);
    
        return res.status(201).json({
        rol: result.rows[0],
        message: 'Rol creado correctamente'
        });
    
    } catch (error) {
        console.error('Error al crear rol:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
    }

    //modificar rol
const modificarRol = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;

  try {
    //verificar que el rol existe
    const rolExistente = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
    if (rolExistente.rows.length === 0) {
      return res.status(404).json({ error: 'Rol no encontrado' });
    }

    //validar que haya datos en el body
    if (!nombre || !descripcion) {
        return res.status(400).json({ error: 'Faltan nombre o descripción del rol' });
    }

    const result = await pool.query(
      `
      UPDATE roles
      SET nombre = $1,
          descripcion = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING id, nombre, descripcion, updated_at
      `,
      [nombre, descripcion, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rol no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al modificar el rol:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};



// Obtener todos los roles

const obtenerRoles = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM roles');
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener roles:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};


// eliminar rol por id
const eliminarRol = async (req, res) => {
    const { id } = req.params;
    try {
        // Verificar si el rol existe
        const rolExistente = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
        if (rolExistente.rows.length === 0) {
            return res.status(404).json({ error: 'Rol no encontrado' });
        }
        // Eliminar el rol
        await pool.query('DELETE FROM roles WHERE id = $1', [id]);
        return res.status(200).json({ message: 'Rol eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar rol:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};


    module.exports = {
        crearRol,
        modificarRol,
        obtenerRoles,
        eliminarRol
    };
