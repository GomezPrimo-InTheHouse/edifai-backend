const pool = require('../../connection/db.js');

const verificarConflictoDeEvento = async (req, res, next) => {
  const { sala_id, fecha_inicio_evento, fecha_fin_evento } = req.body;
  const { id } = req.params; 

  const result = await pool.query(
    `SELECT * FROM eventos 
     WHERE sala_id = $1 
     AND id != $2
     AND fecha_inicio_evento = $3
     AND fecha_fin_evento = $4`,
    [sala_id, id || 0, fecha_inicio_evento, fecha_fin_evento]
  );

  if (result.rows.length > 0) {
    return res.status(400).json({
      error: 'Ya existe un evento con estas fechas en la misma sala',
    });
  }

  next();
};

module.exports = { verificarConflictoDeEvento };
