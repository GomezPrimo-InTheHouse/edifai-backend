const pool = require('../../connection/db.js');


const verificarSalaExiste = async (req, res, next) => {
  const { sala_id } = req.body;

  const result = await pool.query('SELECT * FROM salas WHERE id = $1', [sala_id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Sala no encontrada' });
  }

  next();
};

module.exports = { verificarSalaExiste };
