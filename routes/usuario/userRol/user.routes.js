express = require('express');
const router = express.Router();
//middlewares
const { autorizacionDeRoles } = require('../../../middlewares/autorizacionDeRoles.js');
//controllers
const { crearRol, modificarRol, obtenerRoles, eliminarRol  } = require('../../../controllers/usuario/userRol/rol.controller.js');


// faltaria restringir el acceso a los endpoints de crear y modificar rol a un usuario con rol admin
router.post('/crearRol' ,crearRol); //valida que los datos esten completos
router.get('/getAllRoles', obtenerRoles) //trae datos de todos los roles
router.post('/modificarRol/:id', modificarRol);//valida que el rol exista y que los datos esten completos - podria implementarse un middleware para validar los datos
router.delete('/eliminarRol/:id', eliminarRol) //valida que el rol exista - podria implementarse un middleware para validar los datos

module.exports = router;