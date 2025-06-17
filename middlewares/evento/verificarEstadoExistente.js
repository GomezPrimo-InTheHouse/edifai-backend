const pool = require('../../connection/db.js');

const verificarEstadoExiste = async (req, res, next) => {
  const { estado_id } = req.body;

  const result = await pool.query('SELECT * FROM estado WHERE id = $1', [estado_id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Estado no encontrado' });
  }

  next();
};
module.exports = {verificarEstadoExiste};