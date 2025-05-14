import { db } from '../database/connection.database.js';

const createEspecialidad = async ({ nombre }) => {
  const query = {
    text: `INSERT INTO especialidades (nombre) VALUES ($1) RETURNING *`,
    values: [nombre]
  };
  const result = await db.query(query);
  return result.rows[0];
};

const getAllEspecialidades = async () => {
  const result = await db.query('SELECT * FROM especialidades');
  return result.rows;
};

export const EspecialidadModel = {
  createEspecialidad,
  getAllEspecialidades
};