
const pool = require('../connection/db');

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
    console.log('📢 emitirSSE llamado, _emitirSSE es:', _emitirSSE ? 'función' : 'NULL');

    if (_emitirSSE) _emitirSSE(notificacion);
  } catch (err) {
    console.warn('⚠️  notificar() falló (no crítico):', err.message);
  }
};

module.exports = { notificar, setEmitirSSE };