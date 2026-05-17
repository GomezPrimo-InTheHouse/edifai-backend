// const axios = require('axios');

// const NOTIF_URL = 'http://localhost:7009/notificaciones/interna';

// /**
//  * Emite una notificación al ms-notificaciones.
//  * No lanza error si falla — best effort.
//  */
// const notificar = async ({ tipo, mensaje, usuario_id = null }) => {
//   try {
//     await axios.post(NOTIF_URL, { tipo, mensaje, usuario_id });
//   } catch (err) {
//     console.error('⚠️  notificar() falló (no crítico):', err.message);
//   }
// };

// module.exports = { notificar };

const pool = require('../../connection/db');

// Importar emitirSSE directamente para evitar llamada HTTP entre microservicios
// que corren en el mismo proceso
let _emitirSSE = null;

const setEmitirSSE = (fn) => { _emitirSSE = fn; };

const notificar = async ({ tipo, mensaje, usuario_id = null }) => {
  try {
    const result = await pool.query(
      `INSERT INTO notificaciones (tipo, mensaje, usuario_id) VALUES ($1, $2, $3) RETURNING *`,
      [tipo, mensaje, usuario_id]
    );
    const notificacion = result.rows[0];
    if (_emitirSSE) _emitirSSE(notificacion);
  } catch (err) {
    console.warn('⚠️  notificar() falló (no crítico):', err.message);
  }
};

module.exports = { notificar, setEmitirSSE };