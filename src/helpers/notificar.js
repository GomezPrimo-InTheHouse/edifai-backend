const axios = require('axios');

const NOTIF_URL = 'http://localhost:7009/notificaciones/interna';

/**
 * Emite una notificación al ms-notificaciones.
 * No lanza error si falla — best effort.
 */
const notificar = async ({ tipo, mensaje, usuario_id = null }) => {
  try {
    await axios.post(NOTIF_URL, { tipo, mensaje, usuario_id });
  } catch (err) {
    console.error('⚠️  notificar() falló (no crítico):', err.message);
  }
};

module.exports = { notificar };