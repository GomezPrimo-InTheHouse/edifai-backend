const validarFechasObra = (req, res, next) => {
  const { fecha_fin_estimada, fecha_inicio_estimada } = req.body;

  if (fecha_inicio_estimada && fecha_fin_estimada) {
    if (new Date(fecha_inicio_estimada) >= new Date(fecha_fin_estimada)) {
      return res.status(400).json({
        error: 'La fecha de inicio debe ser anterior a la fecha de fin',
      });
    }
  }

  next();
};

const validarFechasRealesObra = (req, res, next) => {
  const { fecha_fin_real, fecha_inicio_real } = req.body;

  if (fecha_inicio_real && fecha_fin_real) {
    if (new Date(fecha_inicio_real) >= new Date(fecha_fin_real)) {
      return res.status(400).json({
        error: 'La fecha de inicio debe ser anterior a la fecha de fin',
      });
    }
  }

  next();
};

module.exports = { validarFechasObra, validarFechasRealesObra };