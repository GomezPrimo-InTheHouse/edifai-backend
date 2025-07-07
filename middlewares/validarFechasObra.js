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

const validarFechasRealesObra = (req, res, next) => {
  
  const {  fecha_fin_real, 
            fecha_inicio_real, } = req.body;

  if (new Date(fecha_inicio_real) >= new Date(fecha_fin_real)) {
    return res.status(400).json({
      error: 'La fecha de inicio debe ser anterior a la fecha de fin',
    });
  }

  next();
};



module.exports = {validarFechasObra, validarFechasRealesObra};  