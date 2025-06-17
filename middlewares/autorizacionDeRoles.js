const pool = require('../connection/db.js');
const jwt = require('jsonwebtoken');



// recibi por parametro a los roles permitidos, dependiendo de la ruta que se quiera proteger

// ## Roles y Permisos

// - **Asistentes**: Acceso limitado a inscripciones y consulta de programación
// - **Organizadores**: Acceso completo a gestión de eventos y programación
// - **Expositores**: Acceso a sus presentaciones y perfil público
// - **Administradores**: Acceso total al sistema

const autorizacionDeRoles = (...rolesPermitidos) => {
  
  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userRole = decoded.rol;

      if (!rolesPermitidos.includes(userRole)) {
        return res.status(403).json({ error: 'No tienes permisos para acceder a este recurso' });
      }

      // Guardamos los datos del usuario en la request para usarlos después
      req.user = decoded;
      next();
    } catch (error) {
      console.error('Error al verificar token:', error);
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
  };
};





// const verificarEventoExistente = async (req, res, next) => {
//   const { nombre } = req.body;

//   try {
//     const result = await pool.query('SELECT * FROM eventos WHERE nombre = $1', [nombre]);

//     if (result.rows.length > 0) {
//       return res.status(409).json({ error: 'El evento ya existe.' });
//     }

//     next();
//   } catch (error) {
//     console.error('Error al verificar evento existente:', error);
//     return res.status(500).json({ error: 'Error interno del servidor' });
//   }
// };


module.exports = {
  autorizacionDeRoles
};