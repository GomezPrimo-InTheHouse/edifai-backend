
const validarFechasEvento = (req, res, next) => {
  const { fecha_inicio_evento, fecha_fin_evento } = req.body;

  if (new Date(fecha_inicio_evento) >= new Date(fecha_fin_evento)) {
    return res.status(400).json({
      error: 'La fecha de inicio debe ser anterior a la fecha de fin',
    });
  }

  next();
};

module.exports = {validarFechasEvento};
