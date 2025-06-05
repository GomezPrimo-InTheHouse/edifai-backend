const pool = require('../../connection/db.js');

const registerarEvento = async (req, res)=>{
    const {nombre, fecha_inicio, fecha_fin, descripcion, estado_id, ubicacion_id, capacidad} = req.body;


    if (!nombre || !fecha_inicio || !fecha_fin || !descripcion || !estado_id || !ubicacion_id || !capacidad) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
    }
    try {
        const reslt = await pool.query(`
            INSERT INTO eventos (nombre, fecha_inicio, fecha_fin, descripcion, estado_id, ubicacion_id, capacidad)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, nombre, fecha_inicio, fecha_fin, descripcion, estado_id, ubicacion_id, capacidad
        `, [nombre, fecha_inicio, fecha_fin, descripcion, estado_id, ubicacion_id, capacidad]);
        return res.status(201).json({
            evento: reslt.rows[0],
            message: 'Evento registrado correctamente'
        });
    } catch (error) {
        return res.status(500).json({ error: 'Error interno del servidor' });
    }


}

const modificarEvento = async (req,res) =>{
    const {id} = req.params;

    const {nombre, fecha_inicio, fecha_fin, descripcion, estado_id, ubicacion_id, capacidad} = req.body;

    if (!nombre || !fecha_inicio || !fecha_fin || !descripcion || !estado_id || !ubicacion_id || !capacidad) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    try {
        const reslt = await pool.query(`
            UPDATE eventos
            SET nombre = $1, fecha_inicio = $2, fecha_fin = $3, descripcion = $4, estado_id = $5, ubicacion_id = $6, capacidad = $7
            WHERE id = $7
            RETURNING id, nombre, fecha_inicio, fecha_fin, descripcion, estado_id, ubicacion_id
        `, [nombre, fecha_inicio, fecha_fin, descripcion, estado_id, ubicacion_id, id, capacidad]);

        if (reslt.rows.length === 0) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }

        return res.status(200).json({
            evento: reslt.rows[0],
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




module.exports = {
    registerarEvento,
    modificarEvento,
    bajaDeEvento
};