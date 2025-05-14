import {db} from '../database/connection.database.js';

const createObra = async (data) => {
    const { nombre,
        user_id ,
        descripcion,
        ubicacion,
        fecha_inicio,
        fecha_fin,
        estado,
        tipo} = data

        try {
            const query = {
                //devuelve todas las filas afectadas por la consulta, evitar devolver la password.
                text: `INSERT INTO Obra (user_id, description, ubicacion, fecha_inicio, fecha_fin, tipo) VALUES ($1, $2, $3, $4) RETURNING  email, username`,
                values: [
                    user_id,
                    descripcion,
                    ubicacion,
                    fecha_inicio,
                    fecha_fin,
                    estado,
                    tipo
                ],
            }

            const result = await db.query(query);
            return result.rows[0];

        } catch (error) {
            console.log(error)
            res.status(400).json({
                
            })
        }

    }

export const obraModel = {
    createObra,

}