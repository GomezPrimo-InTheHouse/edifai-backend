// const express = require('express');

// const router = express.Router();

// //controladores

// const {
//     crearLabor,
//     obtenerLabores,
//     obtenerLaborPorId,
//     actualizarLabor,
//     darDeBajaLabor,
//     cambiarEstadoLabor,
//     obtenerMisLabores,
//     obtenerLaboresPorObra,
//     obtenerLaboresArchivadas
// } = require ('../../controllers/labores/labores.controller.js')

// //falta adicionar middlewares para verificar rol (solo los admin pueden acceder a estas rutas)

// const {validarFechasObra, validarFechasRealesObra} = require('../../middlewares/validarFechasObra.js')
// const {verificarToken} = require('../../middlewares/autorizacionDeRoles.js')

// const {  verificar_estado,
//     verificar_trabajador,
//     verificar_especialidad,
//     verificar_obra, 
//     verificar_usuario} = require('../../middlewares/verificarExistencias.js')

// router.post('/create',verificar_estado,
//     verificar_trabajador,
//     verificar_especialidad,
//     verificar_obra, validarFechasObra, verificar_usuario, crearLabor);

// router.get('/getAll', verificarToken, obtenerLabores);
// router.get('/archivadas', verificarToken, obtenerLaboresArchivadas);

// router.get('/getOne/:id', verificarToken, obtenerLaborPorId);
// router.get('/mis-labores', verificarToken, obtenerMisLabores);

// router.get('/getByObra/:obra_id', verificarToken, obtenerLaboresPorObra); 

// router.put('/actualizarLabor/:id',verificarToken, verificar_estado,
//     verificar_trabajador,
//     verificar_especialidad,
//     verificar_obra, validarFechasRealesObra, verificar_usuario , actualizarLabor);

// router.delete('/darDeBaja/:id', verificarToken, darDeBajaLabor);
// router.put('/cambiarEstadoLabor/:id', verificarToken, cambiarEstadoLabor)


// module.exports = router;

const express = require('express');
const router = express.Router();

const {
    crearLabor, obtenerLabores, obtenerLaborPorId, actualizarLabor,
    darDeBajaLabor, cambiarEstadoLabor, obtenerMisLabores,
    obtenerLaboresPorObra, obtenerLaboresArchivadas
} = require('../../controllers/labores/labores.controller.js');

const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');
const { validarFechasObra, validarFechasRealesObra } = require('../../middlewares/validarFechasObra.js');
const { verificar_estado, verificar_trabajador, verificar_especialidad, verificar_obra, verificar_usuario } = require('../../middlewares/verificarExistencias.js');

router.post('/create',
    verificarToken,
    (req, res, next) => { console.log('BODY EN RUTA:', JSON.stringify(req.body)); next(); },
    verificar_estado, verificar_trabajador, verificar_especialidad,
    verificar_obra, validarFechasObra,
    crearLabor
);

router.get('/getAll', verificarToken, obtenerLabores);
router.get('/archivadas', verificarToken, obtenerLaboresArchivadas);
router.get('/mis-labores', verificarToken, obtenerMisLabores);
router.get('/getByObra/:obra_id', verificarToken, obtenerLaboresPorObra);
router.get('/getOne/:id', verificarToken, obtenerLaborPorId);

router.put('/actualizarLabor/:id',
    verificarToken,
    verificar_estado, verificar_trabajador, verificar_especialidad,
    verificar_obra, validarFechasRealesObra, verificar_usuario,
    actualizarLabor
);

router.delete('/darDeBaja/:id', verificarToken, darDeBajaLabor);
router.put('/cambiarEstadoLabor/:id', verificarToken, cambiarEstadoLabor);

module.exports = router;