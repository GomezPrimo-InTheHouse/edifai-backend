
import {db} from '../database/connection.database.js';

const createUser = async (user) => {
    const {email, password, username, active} = user;

    

    try {
        const query = {
            //devuelve todas las filas afectadas por la consulta, evitar devolver la password.
            text: `INSERT INTO users 
            (email, password, username, active) VALUES ($1, $2, $3, $4) 
            RETURNING  email, username`,
            values: [email, password, username, active],
        }

        const result = await db.query(query);
        
        return result.rows[0];
        
        
    } catch (error) {
        throw new Error('Error al crear usuario en el model: ' + error.message);


        
    }

    
    
    

    
}

const findOneByEmailModel = async (email) => {
    console.log(email)
    const query = {
        text: `SELECT * FROM users WHERE email = $1`,
        values: [email],
    }
    try {
        const result = await db.query(query);
        return result.rows[0];
    } catch (error) {
        console.error('Error finding user by email:', error);
        throw error;
    }
}

const findOneByUsername = async (username) => {
    const query = {
        text: `SELECT * FROM users WHERE username = $1`,
        values: [username],
    }
    try {
        const result = await db.query(query);

        return result.rows[0];
    } catch (error) {
        console.error('Error finding user by username:', error);
        throw error;
    }
}

const getAllUsers = async ()=>{
    const query = {
        text: `SELECT * FROM users`,
        
    }
    try {
        const result = await db.query(query);
        return result.rows;
    } catch (error) {
        console.error('Error finding users:', error);
        throw error;
    }
}

const deleteUser = async (email) => {
    const isUser = await findOneByEmailModel(email);
    
    if(!isUser){ throw new Error('No existe el usuario')}
    if(isUser){
        try {
            const result = await db.query(`DELETE FROM users WHERE email = $1`, [email]);
            return result.rows[0]
        } catch (error) {
            console.error('Error deleting users:', error);
            throw error;
        }
    }

    
}

export const UserModel = {
    createUser,
    findOneByEmailModel,
    findOneByUsername,
    getAllUsers,
    // findOneById,
    // updateUser,
    deleteUser,
    // getUserById,
    // getUserByUsername,
    // getUserByEmail,
    // getUserByUsernameAndEmail,
    // getUserByUsernameAndPassword,
    // getUserByEmailAndPassword,
    // getUserByUsernameAndEmailAndPassword,
    // getUserByUsernameAndEmailAndPasswordAndId,
    // getUserByUsernameAndEmailAndPasswordAndId,
    // getUserByUsernameAndEmailAndPasswordAndIdAndRole,
    // getUserByUsernameAndEmailAndPasswordAndIdAndRole,
    // getUserByUsernameAndEmailAndPasswordAndIdAndRoleAndStatus,
    // getUserByUsernameAndEmailAndPasswordAndIdAndRoleAndStatus,
    // getUserByUsernameAndEmailAndPasswordAndIdAndRoleAndStatusAndCreatedAt,   


}
