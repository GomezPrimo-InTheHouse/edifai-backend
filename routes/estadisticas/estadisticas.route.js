express = require('express');
const router = express.Router();

//controllers
const { obtenerEstadisticas } = require('../../controllers/estadisticas/estadisticas.controller.js');

//middlewares
const { autorizacionDeRoles } = require('../../middlewares/autorizacionDeRoles.js');

router.get('/obtener', autorizacionDeRoles('admin'), obtenerEstadisticas) //valida que el usuario tenga rol admin



module.exports = router;