const pool = require('../../connection/db.js');

const registrarEvento = async (req, res)=>{
const {
    nombre,
    fecha_inicio_evento,
    fecha_fin_evento,
    descripcion,
    estado_id,
    ubicacion_id,
    capacidad
  } = req.body;

  try {
    
    const nuevoEvento = await pool.query(`
      INSERT INTO eventos 
      (nombre, fecha_inicio_evento, fecha_fin_evento, descripcion, estado_id, ubicacion_id, capacidad)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *;
    `, [
      nombre,
      fecha_inicio_evento,
      fecha_fin_evento,
      descripcion,
      estado_id,
      ubicacion_id,
      capacidad
    ]);

    res.status(201).json({
      mensaje: 'Evento creado correctamente',
      evento: nuevoEvento.rows[0]
    });

  } catch (error) {
    console.error('Error al crear evento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }


}

const modificarEvento = async (req,res) =>{
    const {id} = req.params;

    const {nombre, fecha_inicio_evento, fecha_fin_evento, descripcion, estado_id, ubicacion_id, capacidad} = req.body;

    if (!nombre || !fecha_inicio_evento || !fecha_fin_evento || !descripcion || !estado_id || !ubicacion_id || !capacidad) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    

    try {
       const result = await pool.query(`
        UPDATE eventos
        SET 
            nombre = $1,
            fecha_inicio_evento = $2,
            fecha_fin_evento = $3,
            descripcion = $4,
            estado_id = $5,
            ubicacion_id = $6,
            capacidad = $7
        WHERE id = $8
        RETURNING id, nombre, fecha_inicio_evento, fecha_fin_evento, descripcion, estado_id, ubicacion_id, capacidad
        `, [nombre, fecha_inicio_evento, fecha_fin_evento, descripcion, estado_id, ubicacion_id, capacidad, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }

        return res.status(200).json({
            evento: result.rows[0],
            message: 'Evento modificado correctamente'
        });
    } catch (error) {
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

const bajaDeEvento = async (req, res) => {
    const { id } = req.params;

    try {
        const reslt = await pool.query(`
            UPDATE eventos
            SET estado_id = 2 
            WHERE id = $1
            RETURNING id, nombre, estado_id
        `, [id]);

        if (reslt.rows.length === 0) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }

        return res.status(200).json({
            evento: reslt.rows[0],
            message: 'Evento dado de baja correctamente'
        });
    } catch (error) {
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

//buscar todos los eventos
const buscarEventos = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM eventos ');
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al buscar eventos:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}
const buscarEventoPorId = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('SELECT * FROM eventos WHERE id = $1 ', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al buscar evento por ID:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}




module.exports = {
    registrarEvento,
    modificarEvento,
    bajaDeEvento,
    buscarEventos,
    buscarEventoPorId
};