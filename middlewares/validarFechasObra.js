const validarFechasObra = (req, res, next) => {
  const {  fecha_fin_estimado, 
            fecha_inicio_estimado, } = req.body;

  if (new Date(fecha_inicio_estimado) >= new Date(fecha_fin_estimado)) {
    return res.status(400).json({
      error: 'La fecha de inicio debe ser anterior a la fecha de fin',
    });
  }

  next();
};

module.exports = {validarFechasObra};