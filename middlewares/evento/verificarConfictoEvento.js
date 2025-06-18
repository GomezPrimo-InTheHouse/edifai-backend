const pool = require('../../connection/db.js');

const verificarConflictoDeEvento = async (req, res, next) => {
  const { ubicacion_id, fecha_inicio_evento, fecha_fin_evento } = req.body;
  const { id } = req.params; 

  const result = await pool.query(
    `SELECT * FROM eventos 
     WHERE ubicacion_id = $1 
     AND id != $2
     AND fecha_inicio_evento = $3
     AND fecha_fin_evento = $4`,
    [ubicacion_id, id || 0, fecha_inicio_evento, fecha_fin_evento]
  );

  if (result.rows.length > 0) {
    return res.status(400).json({
      error: 'Ya existe un evento con estas fechas en la misma ubicación.',
    });
  }

  next();
};

module.exports = { verificarConflictoDeEvento };
