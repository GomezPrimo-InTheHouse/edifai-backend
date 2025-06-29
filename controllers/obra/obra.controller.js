const pool = require('../../connection/db.js');
require('dotenv').config();


// Table obras {
//   id serial [pk]
//   usuario_id int [ref: > usuarios.id, not null]
//   nombre varchar(100) [not null]
//   descripcion text
//   ubicacion varchar(200)
//   fecha_inicio_real date
//   fecha_fin_real date
//   fecha_inicio_estimado date
//   fecha_fin_estimado date
//   tipo_obra_id int [ref: > tipos_de_obra.id]
//   estado_id int [ref: > estados.id] 
//   
// }


//create obras
const createObra = async (req,res) =>{
    try {
        const {
            usuario_id, 
            nombre, 
            descripcion, 
            ubicacion, 
            fecha_fin_estimada, 
            fecha_inicio_estimada,
            tipo_obra_id, estado_id} = req.body;

            //validar datos de la obra

            if(!nombre || !descripcion || !ubicacion || !fecha_fin_estimada || !fecha_inicio_estimada || !tipo_obra_id || !estado_id){
                return res.status(400).json({message: 'Faltan datos para crear la obra'})
                }

            
           

            //validar tipo de obra id
            const tipoObra = await pool.query('SELECT * FROM tipos_de_obra WHERE id = $1',[tipo_obra_id])
            if(tipoObra.rows.length === 0){
                return res.status(400).json({message: 'Tipo de obra no existente'});
                }
                    

            const result = await pool.query(`INSERT INTO obras (usuario_id, nombre, descripcion, ubicacion, 
                fecha_fin_estimada, fecha_inicio_estimada,
                tipo_obra_id, estado_id) 
                VALUES ($1, $2, $3, $4, $5, $6
                , $7, $8, $9, $10) RETURNING *`,
                [usuario_id, nombre, descripcion, ubicacion, fecha_fin_estimada, fecha_inicio_estimada,
                    tipo_obra_id, estado_id]);
            
            return res.status(200).json({
                success: true,
                message: 'Obra creada con éxito',
                obra: result.rows[0],
            });      

    } catch (error) {
        res.status(500).json({
            success:false,
            message: 'Error al crear obra',
            error: error.message
        })
    }
}


//getAll obras
const getAllObras = async (_req, res) =>{
    try {
        const result = await pool.query(`SELECT * FROM obras`);
        return res.status(200).json({
            success: true,
            message: 'Obras obtenidas con éxito',
            obras: result.rows,
        });
    } catch (error) {
        res.status(500).json({
            success:false,
            message: 'Error al obtener obras',
            error: error.message
        });
    }
}

//modificar obras

    try {
        const {obra_id} = req.params;
        const { usuario_id, nombre, descripcion, ubicacion, fecha_inicio_real,
            fecha_fin_real, fecha_fin_estimada, fecha_inicio_estimada,
            tipo_obra_id, estado_id} = req.body;

        const result = await pool.query(`
            UPDATE obras SET usuario_id = $1, nombre = $2, descripcion = $3, 
            ubicacion = $4, fecha_inicio_real = $5, fecha_fin_real = $6, 
            fecha_fin_estimada = $7, fecha_inicio_estimada = $8, tipo_obra_id = $9, estado_id
            = $10 WHERE obra_id = $11 RETURNING *`,
            [usuario_id, nombre, descripcion, ubicacion, fecha_inicio_real,
            fecha_fin_real, fecha_fin_estimada, fecha_inicio_estimada,
            tipo_obra_id, estado_id, obra_id]  );

        res.status(200).json({
            success: true,
            message: 'Obra modificada con éxito',
            obra: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al modificar obra',
            error: error.message
        });
    }


//dar de baja obra ( no eliminar)
const darDeBajaObra = async (req, res) => {
    // Placeholder implementation
    res.status(501).json({ success: false, message: 'darDeBajaObra no implementado' });
}

//getObraByID
const getObraByID = async (req, res) => {
    // Placeholder implementation
    res.status(501).json({ success: false, message: 'getObraByID no implementado' });
}

module.exports = {
    createObra,
    getAllObras,
    modificarObra,
    darDeBajaObra,
    getObraByID
}   
