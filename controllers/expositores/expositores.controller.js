const pool = require('../../connection/db.js');


//controller para ver perfil de expositor, junto con sus actividades y los eventos en los que participa

const verActividades = async (req, res) => {
    const { id } = req.params;

    try {
        const expositor = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);

        if (expositor.rows.length === 0) {
            return res.status(404).json({ error: 'usuario Expositor no encontrado' });
        }

        const actividades = await pool.query(`
            SELECT 
                a.id AS actividad_id,
                a.titulo,
                a.descripcion,
                a.fecha,
                a.hora_inicio,
                a.hora_fin,
                a.estado_id,
                est.nombre AS estado_nombre,
                a.evento_id,
                e.nombre AS evento_nombre,
                e.fecha_inicio_evento,
                e.fecha_fin_evento,
                e.descripcion AS evento_descripcion,
                a.sala_id,
                s.nombre AS sala_nombre
                
            FROM actividad_expositores ae
            JOIN actividades a ON ae.actividad_id = a.id
            JOIN eventos e ON a.evento_id = e.id
            LEFT JOIN salas s ON a.sala_id = s.id
            LEFT JOIN estado est ON a.estado_id = est.id
            WHERE ae.usuario_id = $1
        `, [id]);
        
        const eventos = await pool.query(`
            SELECT DISTINCT e.*, a.*
            FROM eventos e
            JOIN actividades a ON a.evento_id = e.id
            JOIN actividad_expositores ae ON ae.actividad_id = a.id
            WHERE ae.usuario_id = $1
            `, [id]);



        return res.status(200).json({
            expositor: expositor.rows[0],
            actividades: actividades.rows,
            evento: eventos.rows
        });
    } catch (error) {
        console.error('Error al obtener actividades del expositor:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }

}

const verPerfilExpositor = async (req, res) => {
    const { id } = req.params;

    try {
        const expositor = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);

        if (expositor.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario Expositor no encontrado' });
        }

        return res.status(200).json(expositor.rows[0]);
    } catch (error) {
        console.error('Error al obtener perfil de expositor:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Exportar el controlador
module.exports = {
    verPerfilExpositor,
    verActividades
};