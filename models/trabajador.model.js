import {db} from '../database/connection.database.js';


const createTrabajador = async (trabajador) => {
    const {
        nombre,
        apellido,
        dni,
        obra_id,
        fecha_ingreso,
        usuario_id,
        especialidad_id,
        jefe_id
    } = trabajador;

    try {
        const query = {
            text: `
                INSERT INTO trabajadores 
                (nombre, apellido, dni, obra_id, fecha_ingreso, usuario_id, especialidad_id, jefe_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `,
            values: [nombre, apellido, dni, obra_id, fecha_ingreso, usuario_id, especialidad_id, jefe_id]
        };

        const result = await db.query(query);
        return result.rows[0];

    } catch (error) {
        throw new Error("Error al crear trabajador en el model: " + error.message);
    }
};

const getAllTrabajadores = async () => {
    try {
        const query = `SELECT * FROM trabajadores`;
        const result = await db.query(query);
        return result.rows;
    } catch (error) {
        throw new Error("Error al obtener trabajadores: " + error.message);
    }
};

const findTrabajadorByDNI = async (dni) => {
    try {
        const query = {
            text: `SELECT * FROM trabajadores WHERE dni = $1`,
            values: [dni]
        };
        const result = await db.query(query);
        return result.rows[0];
    } catch (error) {
        throw new Error("Error al buscar trabajador por DNI: " + error.message);
    }
};
const updateTrabajador = async (id, updatedFields) => {
    const {
        nombre,
        apellido,
        dni,
        obra_id,
        fecha_ingreso,
        usuario_id,
        especialidad_id,
        jefe_id
    } = updatedFields;

    try {
        const query = {
            text: `
                UPDATE trabajadores SET
                    nombre = $1,
                    apellido = $2,
                    dni = $3,
                    obra_id = $4,
                    fecha_ingreso = $5,
                    usuario_id = $6,
                    especialidad_id = $7,
                    jefe_id = $8
                WHERE id = $9
                RETURNING *
            `,
            values: [nombre, apellido, dni, obra_id, fecha_ingreso, usuario_id, especialidad_id, jefe_id, id]
        };

        const result = await db.query(query);
        return result.rows[0];

    } catch (error) {
        throw new Error("Error al actualizar trabajador: " + error.message);
    }
};

const getTrabajadoresByObraId = async (obra_id) => {
    try {
        const query = {
            text: `SELECT * FROM trabajadores WHERE obra_id = $1`,
            values: [obra_id]
        };

        const result = await db.query(query);
        return result.rows;

    } catch (error) {
        throw new Error("Error al obtener trabajadores por obra_id: " + error.message);
    }
};
const getTrabajadorByDNI = async (dni) => {
    try {
        const query = {
            text: `SELECT * FROM trabajadores WHERE dni = $1`,
            values: [dni]
        };
        const result = await db.query(query);
        return result.rows[0];
    } catch (error) {
        throw new Error("Error al buscar trabajador por DNI: " + error.message);
    }
};

const getTrabajadoresByNombreApellido = async (nombre, apellido) => {
    try {
        const query = {
            text: `SELECT * FROM trabajadores WHERE nombre ILIKE $1 AND apellido ILIKE $2`,
            values: [nombre, apellido]
        };
        const result = await db.query(query);
        return result.rows;
    } catch (error) {
        throw new Error("Error al buscar trabajador por nombre y apellido: " + error.message);
    }
};

const getTrabajadoresByJefeId = async (jefe_id) => {
    try {
        const query = {
            text: `SELECT * FROM trabajadores WHERE jefe_id = $1`,
            values: [jefe_id]
        };
        const result = await db.query(query);
        return result.rows;
    } catch (error) {
        throw new Error("Error al buscar trabajadores por jefe_id: " + error.message);
    }
};

export const TrabajadorModel = {
    createTrabajador,
    getAllTrabajadores,
    findTrabajadorByDNI,
    updateTrabajador,
    getTrabajadoresByObraId,
    getTrabajadorByDNI,
    getTrabajadoresByNombreApellido,
    getTrabajadoresByJefeId
};
