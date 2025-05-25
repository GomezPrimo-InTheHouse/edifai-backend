// microservicio-historial.js
const pool = require('./db/db.js'); // Asumo que tienes tu conexión a PostgreSQL en db.js

const registrarHistorial = async ({ username, accion, estado, mensaje }) => {
  try {
    const query = `
      INSERT INTO historial (username, accion, estado, mensaje)
      VALUES ($1, $2, $3, $4)
    `;
    const values = [username || null, accion, estado, mensaje || null];

    await pool.query(query, values);

    console.log(`[Historial] Acción registrada: ${accion} - Usuario: ${username} - Estado: ${estado}`);
  } catch (error) {
    console.error(`[Historial] Error al registrar historial:`, error);
  }
};

module.exports = { registrarHistorial };
