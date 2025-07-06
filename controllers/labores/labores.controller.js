const pool = require('../../connection/db.js');

// Crear una nueva labor
const crearLabor = async (req, res) => {
    try {
        const {
            obra_id, descripcion,
            fecha_inicio_estimada, fecha_fin_estimada,
            fecha_inicio_real, fecha_fin_real,
            estado_id, trabajador_id
        } = req.body;

    const result = await pool.query(`
      INSERT INTO labores (
        obra_id, descripcion,
        fecha_inicio_estimada, fecha_fin_estimada,
        fecha_inicio_real, fecha_fin_real,
        estado_id, trabajador_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [
            obra_id, descripcion,
            fecha_inicio_estimada, fecha_fin_estimada,
            fecha_inicio_real, fecha_fin_real,
            estado_id, trabajador_id
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al crear labor:', error);
        res.status(500).json({ error: 'Error al crear la labor' });
    }
};

// Obtener todas las labores
const obtenerLabores = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM labores');
        res.status(200).json({
            success:true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error al obtener labores:', error);
        res.status(500).json({ error: 'Error al obtener las labores' });
    }
};

// Obtener una labor por ID
const obtenerLaborPorId = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('SELECT * FROM labores WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Labor no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener labor:', error);
        res.status(500).json({ error: 'Error interno' });
    }
};

// Actualizar una labor
const actualizarLabor = async (req, res) => {
    const { id } = req.params;
    const {
        obra_id, descripcion,
        fecha_inicio_estimada, fecha_fin_estimada,
        fecha_inicio_real, fecha_fin_real,
        estado_id, trabajador_id
    } = req.body;

    try {
        const result = await pool.query(`
      UPDATE labores SET
        obra_id = $1,
        descripcion = $2,
        fecha_inicio_estimada = $3,
        fecha_fin_estimada = $4,
        fecha_inicio_real = $5,
        fecha_fin_real = $6,
        estado_id = $7,
        trabajador_id = $8
      WHERE id = $9
      RETURNING *
    `, [
            obra_id, descripcion,
            fecha_inicio_estimada, fecha_fin_estimada,
            fecha_inicio_real, fecha_fin_real,
            estado_id, trabajador_id, id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Labor no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al actualizar labor:', error);
        res.status(500).json({ error: 'Error al actualizar la labor' });
    }
};

// Eliminar una labor, cambiando su estado a estado_id = 2

const darDeBajaLabor = async (req, res) => {
    try {
        const estado_id = 2
        const { id } = req.params;

        const labor = await pool.query(`
            Select * from labores Where id = $1
            `, [id]);

        if (labor.rows.length === 0) {
            return res.status(404).json({ error: 'Labor no encontrada' });
        }

        const result = await pool.query(`
            UPDATE labores SET
            estado_id = $1
            WHERE id = $2
            RETURNING *
            `, [estado_id, id]);

        res.status(200).json({
            success: true,
            message: 'Labor dada de baja exitosamente',
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al dar de baja la labor'
        })
    }
}

const cambiarEstadoLabor = async (req, res) => {
    try {
        const { id } = req.params
        const { estado_id } = req.body

        //verficar labor  existente

        const labor = await pool.query(`
            Select * from labores Where id = $1
        `, [id]);
      
        if (labor.rows.length === 0) {
            return res.status(404).json({ error: 'Labor no encontrada' });
        }


        //verificar estado existente

        const estado = await pool.query(`
        Select * from estados Where id = $1
        `, [estado_id]);
        
        if (estado.rows.length === 0) {
            return res.status(404).json({ error: 'Estado no encontrado' });
        }

        //cambiar estado

        const result = await pool.query(
            `
            UPDATE labores SET
            estado_id = $1
            WHERE id = $2
            RETURNING *
            `,
            [estado_id, id]
        )
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success:false,
                error: 'No se pudo cambiar el estado de la labor'
            })
        }

        res.status(200).json({
            success: true,
            message: 'Estado de la labor cambiado con exito',
            data: result.rows[0]
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al cambiar el estado de la labor'
        })
    }
}

module.exports = {
    crearLabor,
    obtenerLabores,
    obtenerLaborPorId,
    actualizarLabor,
    darDeBajaLabor,
    cambiarEstadoLabor
};
