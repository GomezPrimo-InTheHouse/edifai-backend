const express = require('express');

const router = express.Router();

//controladores

const {
    crearLabor,
    obtenerLabores,
    obtenerLaborPorId,
    actualizarLabor,
    darDeBajaLabor,
    cambiarEstadoLabor,
    obtenerMisLabores,
    obtenerLaboresPorObra,
    obtenerLaboresArchivadas
} = require ('../../controllers/labores/labores.controller.js')

//falta adicionar middlewares para verificar rol (solo los admin pueden acceder a estas rutas)

const {validarFechasObra, validarFechasRealesObra} = require('../../middlewares/validarFechasObra.js')
const {verificarToken} = require('../../middlewares/autorizacionDeRoles.js')

const {  verificar_estado,
    verificar_trabajador,
    verificar_especialidad,
    verificar_obra, 
    verificar_usuario} = require('../../middlewares/verificarExistencias.js')

router.post('/create',verificar_estado,
    verificar_trabajador,
    verificar_especialidad,
    verificar_obra, validarFechasObra, verificar_usuario, crearLabor);

router.get('/getAll', obtenerLabores);
router.get('/archivadas', obtenerLaboresArchivadas);

router.get('/getOne/:id', obtenerLaborPorId);
router.get('/mis-labores', verificarToken, obtenerMisLabores);

router.get('/getByObra/:obra_id', obtenerLaboresPorObra); 

router.put('/actualizarLabor/:id',verificar_estado,
    verificar_trabajador,
    verificar_especialidad,
    verificar_obra, validarFechasRealesObra, verificar_usuario , actualizarLabor);

router.delete('/darDeBaja/:id', darDeBajaLabor);
router.put('/cambiarEstadoLabor/:id', cambiarEstadoLabor)


module.exports = router;