const pool = require('../../connection/db.js');
require('dotenv').config();


//obtener todos los trabajadores

const getAllTrabajadores = async (req, res)=>{
    try {
        const result = await pool.query('SELECT * FROM trabajadores ORDER BY id');
        return res.status(200).json(result.rows);
        
    } catch (error) {
        console.error('Error al obtener trabajadores:', error);
        return res.status(500).json({ error: 'Error al obtener trabajadores' });
    }

}

//crear un nuevo trabajador
// Table trabajadores {
//   id serial [pk]
//   nombre varchar
//   apellido varchar
//   dni varchar [unique]
//   telefono varchar(50)
//   fecha_ingreso date
//   obra_id int [ref: > obras.id]
//   estado_id int [ref: > estados.id] 
//   usuario_id int [ref: > usuarios.id]
//   especialidad_id int [ref: > especialidades.id]
//   jefe_id int [ref: > trabajadores.id]
//   usuario_creador_id int [ref :> usuarios.id]
// }

const createTrabajador = async (req, res) => {
    
    
    try {


        const {
        nombre,
        apellido,
        dni,
        telefono,
        fecha_ingreso,
        obra_id,
        estado_id,
        usuario_id,
        especialidad_id,
        jefe_id,
        usuario_creador_id
         
           
    } = req.body

    // verificamos la NO existencia el dni en la db 

    const dniExistente = await pool.query('SELECT * FROM trabajadores WHERE dni = $1', [dni]);
    if (dniExistente.rows.length > 0) {
        return res.status(400).json({ error: 'El DNI ya está registrado' });
    }

    // validar el usuario creador
    const usuarioCreador = await pool.query('SELECT * FROM usuarios WHERE id = $1', [usuario_creador_id]);
    if (usuarioCreador.rows.length === 0) {
        return res.status(404).json({ error: 'Usuario creador no encontrado' });
    }

    if(jefe_id){
        const usuarioJefe = await pool.query('SELECT * FROM usuarios WHERE id = $1', [jefe_id]);
        if(usuarioJefe.rows.length === 0) {
            return res.status(404).json({ error: 'Jefe no encontrado' });
        }

    }
    //query para registrar el nuevo trabajador luego de todas las valideishons

   const nuevoTrabajador = await pool.query(`INSERT INTO trabajadores 
    (nombre, apellido, dni,telefono, fecha_ingreso, obra_id, estado_id, 
    usuario_id, especialidad_id, jefe_id, usuario_creador_id) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
    RETURNING *`,
    [nombre, apellido, dni, telefono,
         fecha_ingreso, obra_id, estado_id,
          usuario_id, especialidad_id, jefe_id, 
          usuario_creador_id]);    
        
    const trabajadorCreado = nuevoTrabajador.rows[0];
    res.status(200).json({
        message:'Success',
        data: trabajadorCreado

    })

    } catch (error) {
        console.error('Error: al cargar trabajador:', error);
        return res.status(500).json({ error: 'Error al crear trabajador' });
        
    }
   



}

//modificar un trabajador

const modificarTrabajador = async (req, res) => {
    const {id} = req.params;
    const { nombre, apellido, dni, 
        telefono, fecha_ingreso, 
        obra_id, estado_id, usuario_id, 
        especialidad_id, jefe_id 
       } = req.body;

    try {
        // Verificar que el trabajador existe
        const trabajadorExistente = await pool.query('SELECT * FROM trabajadores WHERE id = $1', [id]);
        if (trabajadorExistente.rows.length === 0) {
            return res.status(404).json({ error: 'Trabajador no encontrado' });
        }

        // Actualizar el trabajador
        const result = await pool.query(`
            UPDATE trabajadores 
            SET nombre = $1, apellido = $2, dni = $3, telefono = $4, fecha_ingreso = $5, 
                obra_id = $6, estado_id = $7, usuario_id = $8, especialidad_id = $9, jefe_id = $10 
            WHERE id = $11 
            RETURNING *
        `, [nombre, apellido, dni, telefono, fecha_ingreso, obra_id, estado_id, usuario_id, especialidad_id, jefe_id, id]);

        const trabajadorModificado = result.rows[0];
        return res.status(200).json({
            message: 'Success',
            data: trabajadorModificado
        });
        
    } catch (error) {
        console.error('Error al modificar trabajador:', error);
        return res.status(500).json({ error: 'Error al modificar trabajador' });
        
    }
}

//dar de baja un trabajador, sin borrarlo de la base de datos
const darDeBajaTrabajador = async (req, res) => {
    const { id } = req.params;
    try {
        // Verificar que el trabajador existe
        const trabajadorExistente = await pool.query('SELECT * FROM trabajadores WHERE id = $1', [id]);
        if (trabajadorExistente.rows.length === 0) {
            return res.status(404).json({ error: 'Trabajador no encontrado' });
        }

        // Actualizar el estado del trabajador a inactivo (estado_id = 2)
        const result = await pool.query(`
            UPDATE trabajadores 
            SET estado_id = 2, updated_at = $1 
            WHERE id = $2 
            RETURNING *
        `, [new Date(), id]);

        const trabajadorBaja = result.rows[0];
        return res.status(200).json({
            message: 'Trabajador dado de baja correctamente',
            data: trabajadorBaja
        });
        
    } catch (error) {
        console.error('Error al dar de baja al trabajador:', error);
        return res.status(500).json({ error: 'Error al dar de baja al trabajador' });
    }
};




module.exports = {
    getAllTrabajadores,
    createTrabajador,
    modificarTrabajador,
    darDeBajaTrabajador
};