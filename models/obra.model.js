import { db } from "../database/connection.database.js";

// Crear obra
const createObra = async (obra) => {
  try {
    const query = {
      text: `
        INSERT INTO obras (usuario_id, nombre, descripcion, ubicacion, fecha_inicio_estimada, fecha_fin_estimada, tipo, estado)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `,
      values: [
        obra.usuario_id,
        obra.nombre,
        obra.descripcion,
        obra.ubicacion,
        obra.fecha_inicio_estimada,
        obra.fecha_fin_estimada,
        obra.tipo,
        obra.estado
      ]
    };

    const result = await db.query(query);
    return result.rows[0];
  } catch (error) {
    console.error("Error en createObra:", error);
    throw error;
  }
};

// Obtener todas las obras
const getAllObras = async () => {
  try {
    const result = await db.query("SELECT * FROM obras");
    return result.rows;
  } catch (error) {
    console.error("Error en getAllObras:", error);
    throw error;
  }
};

// Actualizar obra
const updateObra = async (id, datos) => {
  try {
    const query = {
      text: `
        UPDATE obras SET 
          nombre = $1,
          descripcion = $2,
          ubicacion = $3,
          fecha_inicio_estimada = $4,
          fecha_fin_estimada = $5,
          fecha_inicio_real = $6,
          fecha_fin_real = $7,
          tipo = $8,
          estado = $9
        WHERE id = $10
        RETURNING *;
      `,
      values: [
        datos.nombre,
        datos.descripcion,
        datos.ubicacion,
        datos.fecha_inicio_estimada,
        datos.fecha_fin_estimada,
        datos.fecha_inicio_real,
        datos.fecha_fin_real,
        datos.tipo,
        datos.estado,
        id
      ]
    };

    const result = await db.query(query);
    return result.rows[0];
  } catch (error) {
    console.error("Error en updateObra:", error);
    throw error;
  }
};

// Eliminar obra
const deleteObra = async (id) => {
  try {
    await db.query("DELETE FROM obras WHERE id = $1", [id]);
  } catch (error) {
    console.error("Error en deleteObra:", error);
    throw error;
  }
};

// Buscar por ubicación
const getByUbicacion = async (ubicacion) => {
  try {
    const result = await db.query(
      `SELECT * FROM obras WHERE ubicacion ILIKE $1`,
      [`%${ubicacion}%`]
    );
    return result.rows;
  } catch (error) {
    console.error("Error en getByUbicacion:", error);
    throw error;
  }
};

// Buscar por estado
const getByEstado = async (estadoId) => {
  try {
    const result = await db.query(
      `SELECT * FROM obras WHERE estado = $1`,
      [estadoId]
    );
    return result.rows;
  } catch (error) {
    console.error("Error en getByEstado:", error);
    throw error;
  }
};

// Obtener obras finalizadas
const getObrasFinalizadas = async () => {
  try {
    const result = await db.query(
      `SELECT * FROM obras WHERE fecha_fin_real IS NOT NULL`
    );
    return result.rows;
  } catch (error) {
    console.error("Error en getObrasFinalizadas:", error);
    throw error;
  }
};

// Obtener obras ordenadas por retraso (fecha estimada vs real)
const getObrasPorRetraso = async () => {
  try {
    const result = await db.query(`
      SELECT *,
        (fecha_fin_real - fecha_fin_estimada) AS dias_retraso
      FROM obras
      WHERE fecha_fin_real IS NOT NULL
      ORDER BY dias_retraso DESC
    `);
    return result.rows;
  } catch (error) {
    console.error("Error en getObrasPorRetraso:", error);
    throw error;
  }
};

export const ObraModel = {
  createObra,
  getAllObras,
  updateObra,
  deleteObra,
  getByUbicacion,
  getByEstado,
  getObrasFinalizadas,
  getObrasPorRetraso
};
