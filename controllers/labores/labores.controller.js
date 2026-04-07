const pool = require('../../connection/db.js');

// Crear una nueva labor
const crearLabor = async (req, res) => {
  try {
    const {
      obra_id,
      descripcion,
      fecha_inicio_estimada,
      fecha_fin_estimada,
      estado_id,
      trabajador_id,
      nombre,
      especialidad_id,
      usuario_creador_id
    } = req.body;

    // 1. Insertar la labor
    const result = await pool.query(`
      INSERT INTO labores (
        obra_id, descripcion, fecha_inicio_estimada, fecha_fin_estimada,
        estado_id, trabajador_id, nombre, especialidad_id, usuario_creador_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [obra_id, descripcion, fecha_inicio_estimada, fecha_fin_estimada,
        estado_id, trabajador_id, nombre, especialidad_id, usuario_creador_id]);

    const labor = result.rows[0];

    // 2. Si tiene trabajador asignado, registrar en labores_trabajadores
    if (trabajador_id) {
      await pool.query(`
        INSERT INTO labores_trabajadores (labor_id, trabajador_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [labor.id, trabajador_id]);
    }

    res.status(200).json({
      success: true,
      data: labor
    });
  } catch (error) {
    console.error('Error al crear labor:', error);
    res.status(500).json({ error: 'Error al crear la labor' });
  }
};

// Obtener todas las labores
const obtenerLabores = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM labores ORDER BY id');
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
    obra_id, descripcion, fecha_inicio_estimada, fecha_fin_estimada,
    estado_id, trabajador_id, nombre, especialidad_id, usuario_creador_id,
    fecha_inicio_real, fecha_fin_real
  } = req.body;

  try {
    const result = await pool.query(`
      UPDATE labores SET
        obra_id=$1, descripcion=$2,
        fecha_inicio_estimada=$3, fecha_fin_estimada=$4,
        estado_id=$5, trabajador_id=$6, nombre=$7,
        especialidad_id=$8, usuario_creador_id=$9,
        fecha_inicio_real=$10, fecha_fin_real=$11,
        updated_at=NOW()
      WHERE id=$12 RETURNING *
    `, [
      obra_id,
      descripcion,
      fecha_inicio_estimada || null,
      fecha_fin_estimada || null,
      estado_id,
      trabajador_id,
      nombre,
      especialidad_id,
      usuario_creador_id,
      fecha_inicio_real || null,
      fecha_fin_real || null,
      id
    ]);

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Labor no encontrada' });

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar labor:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
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

//obtener labores de un trabajador específico, usando su usuario_id (viene del JWT)

const obtenerMisLabores = async (req, res) => {
  try {
    // userId viene del JWT — asegurate que el middleware de auth lo carga en req.user
    const userId = req.user?.userId;
    console.log('obtenerMisLabores - userId desde JWT:', userId);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const result = await pool.query(
      `
      SELECT DISTINCT l.*
      FROM labores l
      JOIN labores_trabajadores lt ON lt.labor_id = l.id
      JOIN trabajadores t ON t.id = lt.trabajador_id
      WHERE t.usuario_id = $1
      ORDER BY l.id
      `,
      [userId]
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error al obtener mis labores:', error);
    res.status(500).json({ error: 'Error al obtener las labores' });
  }
};

module.exports = {
    crearLabor,
    obtenerLabores,
    obtenerLaborPorId,
    actualizarLabor,
    darDeBajaLabor,
    cambiarEstadoLabor,
    obtenerMisLabores
};
