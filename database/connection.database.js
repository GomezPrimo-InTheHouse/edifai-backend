// crear conexion con database postgres 
import pg from 'pg';
import 'dotenv/config';

// import { Pool } from 'pg';


const {Pool} = pg ; 

const connectionString = process.env.DATABASE_URL ;


export const db = new Pool({
    allowExit: true,
    connectionString,

});

try {
    
    

    await db.query('SELECT NOW()');

    console.log('Database postgres connection is working');
} catch (error) {
    console.error('Error connecting to the database', error);   
    
}




export default db;