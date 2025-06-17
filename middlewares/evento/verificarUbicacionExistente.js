const pool = require('../../connection/db.js');

const verificarUbicacionExiste = async (req, res, next) => {
  const { ubicacion_id } = req.body;

  const result = await pool.query('SELECT * FROM ubicacion WHERE id = $1', [ubicacion_id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Ubicación no encontrada' });
  }

  next();
};

module.exports = { verificarUbicacionExiste };
