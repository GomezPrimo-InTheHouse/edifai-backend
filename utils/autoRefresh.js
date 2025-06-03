
const axios = require('axios');
const pool = require('../db/db.js'); 

async function getRefreshToken(username) {
  const { rows } = await pool.query('SELECT refresh_token FROM sesiones WHERE username = $1', [username]);
  return rows[0]?.refresh_token;
}


async function startAutoRefresh() {
  console.log('Iniciando tarea programada para renovar accessToken...');
  setInterval(async () => {
    try {
      const username = process.env.AUTH_USERNAME;

      const refreshToken = await getRefreshToken(username);

      if (!refreshToken) {
        console.error('No se encontró el refreshToken en la base de datos');
        return;
      }

      const response = await axios.post('http://localhost:6000/refresh', { refreshToken });

      const newAccessToken = response.data.accessToken;

      // Actualizar accessToken en la base
      await pool.query('UPDATE sesiones SET access_token = $1, updated_at = CURRENT_TIMESTAMP WHERE username = $2', [newAccessToken, username]);

      console.log('✅ AccessToken renovado automáticamente:', newAccessToken);
    } catch (error) {
      console.error('Error en tarea programada:', error.response?.data || error.message);
    }
  }, 1 * 60 * 1000); // cada 10 minutos
}




module.exports = { startAutoRefresh };
