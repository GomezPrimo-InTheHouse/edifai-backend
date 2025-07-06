const db = require('../../connection/db.js');
require('dotenv').config();

//create tipo de obra
const createTipoObra = async (req, res) => {
    try {

        const { nombre, descripcion } = req.body;
        if (!nombre || !descripcion) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos requeridos'
            });
        }

        const result = await db.query(
            `INSERT INTO tipos_de_obra (nombre, descripcion) VALUES ($1, $2) RETURNING *`, [nombre, descripcion]
        )

        res.status(200).json({
            success: true,
            data: result.rows[0]
        }
        )

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error de servicor al crear tipo de obra'

        })
    }

}

const modificarTipoDeObra = async (req, res) => {
    try {
        const { id } = req.params
        const { nombre, descripcion } = req.body;

        //verificar si existe el tipo de obra con el id proporcionado
        const tipoDeObra = await db.query(
            `SELECT * FROM tipos_de_obra WHERE id = $1`, [id])

        if (tipoDeObra.rows.length === 0) {
            return res.status(404).json({
                success: false, message: 'Tipo de obra no encontrado'
            })
        }

        //modificar el tipo de obra
        const result = await db.query(
            `UPDATE tipos_de_obra SET nombre = $1, descripcion = $2 WHERE id = $3
            RETURNING *`, [nombre, descripcion, id])

        res.status(200).json({
            success: true,
            data: result.rows[0]
        })



    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error de servidor al modificar tipo de obra'
        })

    }
}

const darDeBajaTipoObra = async (req, res) => {
    try {
        const { id } = req.params
        const tipoDeObra = await db.query(
            `SELECT * FROM tipos_de_obra WHERE id = $1`, [id])
        if (tipoDeObra.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tipo de obra no encontrado'
            })
        }

        const result = await db.query(
            `UPDATE tipos_de_obra SET active = false WHERE id = $1`, [id]
        );
        res.status(200).json({
            success: true,
            data: result.rows[0],
            message: 'Tipo de obra dado de baja'
            })
    


    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error de servidor al dar de baja tipo de obra'
            })

    }
}


const getAllTipoDeObra = async (_req, res) => {
    try {
        const tipoDeObra = await db.query(`SELECT * FROM tipos_de_obra WHERE active = true`)
            res.status(200).json({          
                success: true,
                data: tipoDeObra.rows
            })
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error de servidor al obtener tipos de obra'
        })
    }
}



module.exports = {
    createTipoObra,
    modificarTipoDeObra,
    darDeBajaTipoObra,
    getAllTipoDeObra


}