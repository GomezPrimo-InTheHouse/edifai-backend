express = require('express');
const router = express.Router();
//controllers
const { obtenerEspecialidades,
     modificarEspecialidad,
     crearEspecialidad, 
     eliminarEspecialidad  } = require('../../controllers/especialidad/especialidad.controller.js');

//middlewares



const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');

router.get('/getAll', verificarToken, obtenerEspecialidades);
router.put('/modificar/:id', verificarToken, modificarEspecialidad);
router.post('/crear', verificarToken, crearEspecialidad); //valida que los datos esten completos
router.delete('/eliminar/:id', verificarToken, eliminarEspecialidad); //valida que la especialidad
// exista - podria implementarse un middleware para validar los datos


//exportar modulos

module.exports = router;
