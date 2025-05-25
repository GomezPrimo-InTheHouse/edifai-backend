// utils/autoRefresh.js
const fetch = require('node-fetch'); 
const axios = require('axios');
// Función que inicia la tarea automática cada 55 minutos
// function startAutoRefresh() {
//   setInterval(async () => {
//     try {
//       const response = await fetch('http://localhost:6000/refresh', {
//         method: 'POST',
//         credentials: 'include', // Importante para enviar cookies
//         headers: { 'Content-Type': 'application/json' },
//         // No enviamos el body manualmente, las cookies irán en la cabecera automáticamente
//       });

//       if (response.ok) {
//         const data = await response.json();
//         console.log('✅ AccessToken renovado automáticamente:', data.accessToken);
//       } else {
//         console.log('⚠️ Error al renovar el token automáticamente');
//       }

//     } catch (error) {
//       console.error('Error en tarea programada:', error);
//     }
//   }, 55 * 60 * 1000); // cada 55 minutos
// }

function startAutoRefresh() {
  let contador = 0;
  const intervalo = 55 * 60 * 1000; // 55 minutos en ms
  const intervaloMinutos = 1 * 60 * 1000; // 1 minuto en ms
  let minutosRestantes = intervalo / 60000; // Convertir a minutos

  console.log(`⏳ Comenzando tarea de auto-refresh (cada ${minutosRestantes} min)`);

  // Mostrar contador cada minuto
  const tickMinuto = setInterval(() => {
    minutosRestantes--;
    if (minutosRestantes > 0) {
      console.log(`🕒 Quedan ${minutosRestantes} minutos para el próximo refresh...`);
    }
  }, intervaloMinutos);

  // Ejecutar la tarea cada 55 minutos
  const tarea = setInterval(async () => {
    try {
      const response = await axios.post('http://localhost:6000/refresh', {
        method: 'POST',
        credentials: 'include', // Importante para enviar cookies
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ AccessToken renovado automáticamente:', data.accessToken);
      } else {
        console.log('⚠️ Error al renovar el token automáticamente');
      }

    } catch (error) {
      console.error('Error en tarea programada:', error);
    }

    // Reiniciar el contador
    minutosRestantes = intervalo / 60000;
  }, intervalo);
}



module.exports = { startAutoRefresh };
