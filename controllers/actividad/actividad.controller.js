const pool = require('../../connection/db.js');

const registrarActividad = async (req, res) =>{

    const {
        titulo,
        descripcion,
        fecha,
        hora,
        ubicacion_id,
        estado_id,
        evento_id,
        sala_id,
        expositor_id,
        asistente_id
    } = req.body

    if (!titulo || !descripcion || !fecha || !hora || !ubicacion_id || !estado_id || !evento_id || !sala_id || !expositor_id || !asistente_id) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    try {
        const result = await pool.query(`
            INSERT INTO actividades (titulo, descripcion, fecha, hora, ubicacion_id, estado_id, evento_id, sala_id, expositor_id, asistente_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, titulo, descripcion, fecha, hora, ubicacion_id, estado_id, evento_id, sala_id, expositor_id, asistente_id
        `, [titulo, descripcion, fecha, hora, ubicacion_id, estado_id, evento_id, sala_id, expositor_id, asistente_id]);

        return res.status(201).json({
            actividad: result.rows[0],
            message: 'Actividad registrada correctamente'
        });

    } catch (error) {
        console.error('Error al registrar actividad:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }

}