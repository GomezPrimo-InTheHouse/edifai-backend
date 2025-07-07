//middleware destinado para verificar las existencias de estado_id, usuario_id, trabajador_id, especialidad_id,
//labor_id, obra_id
const pool = require('../connection/db.js')

const verificar_especialidad = async (req, res, next) => {
    const { especialidad_id } = req.body;

    const verificar_existencia_especialidad = await pool.query(
        `SELECT * FROM especialidades WHERE id = $1`,
        [especialidad_id]
    )
    if (verificar_existencia_especialidad.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Especialidad no encontrada' })
    }
    next()
}

const verificar_estado = async (req, res, next) => {
    const { estado_id } = req.body;
    const verificar_existencia_estado = await pool.query(
        `SELECT * FROM estados WHERE id = $1`,
        [estado_id]
    )
    if (verificar_existencia_estado.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Estado no encontrado' })
    }

    next()

}

const verificar_trabajador = async (req, res, next) => {
    const { trabajador_id } = req.body;
    const verificar_existencia_trabajador = await pool.query(
        `SELECT * FROM trabajadores WHERE id = $1`,
        [trabajador_id]
    )
    if (verificar_existencia_trabajador.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Trabajador no encontrado' })
    }
    next()
}

const verificar_usuario = async (req, res, next) => {
    const { usuario_creador_id } = req.body;



    const verificar_existencia_usuario_creador = await pool.query(
        `SELECT * FROM usuarios WHERE id = $1`, [usuario_creador_id])



    if (verificar_existencia_usuario_creador.rows.length === 0) {
        return res.status(404).json({
            success: false, message: 'Usuario creador no encontrado'
        })
    }

    next()
}

const verificar_obra = async (req, res, next) => {
    const { obra_id } = req.body;
    const verificar_existencia_obra = await pool.query(
        `SELECT * FROM obras WHERE id = $1`,
        [obra_id]
    )
    if (verificar_existencia_obra.rows.length === 0) {
        res.status(404).json({
            success: false,
            message: 'Obra no encontrada'
        })
    }
    next()
}

const verificar_labor = async (req, res, next) => {
    const { labor_id } = req.params;
    const verificar_existencia_labor = await pool.query(
        `SELECT * FROM labores WHERE id = $1`,
        [labor_id]
    )
    if (verificar_existencia_labor.rows.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Labor no encontrada'
        })
    }
    next()
}

const verificar_tipo_obra = async (req, res, next) => {
    const { tipo_obra_id } = req.body;
    const verificar_existencia_tipo_obra = await pool.query(
        `SELECT * FROM tipos_de_obra WHERE id = $1`,
        [tipo_obra_id]
    )
    if (verificar_existencia_tipo_obra.rows.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Tipo de obra no encontrada'
        })
    }
    next()
}

module.exports = {
    verificar_estado,
    verificar_trabajador,
    verificar_especialidad,
    verificar_obra,
    verificar_labor,
    verificar_usuario,
    verificar_tipo_obra
}