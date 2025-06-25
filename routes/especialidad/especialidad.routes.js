express = require('express');
const router = express.Router();
//controllers
const { obtenerEspecialidades,
     modificarEspecialidad,
     crearEspecialidad, 
     eliminarEspecialidad  } = require('../../controllers/especialidad/especialidad.controller.js');

//middlewares



router.get('/getAll', obtenerEspecialidades);
router.put('/modificar/:id', modificarEspecialidad);
router.post('/crear', crearEspecialidad); //valida que los datos esten completos
router.delete('/eliminar/:id', eliminarEspecialidad); //valida que la especialidad
// exista - podria implementarse un middleware para validar los datos


//exportar modulos

module.exports = router;