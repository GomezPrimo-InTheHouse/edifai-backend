const express = require('express');

const router = express.Router();

//controladores

const {
    crearLabor,
    obtenerLabores,
    obtenerLaborPorId,
    actualizarLabor,
    darDeBajaLabor,
    cambiarEstadoLabor
} = require ('../../controllers/labores/labores.controller.js')

//falta adicionar middlewares para verificar rol (solo los admin pueden acceder a estas rutas)

const {validarFechasObra, validarFechasRealesObra} = require('../../middlewares/validarFechasObra.js')
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

router.get('/getOne/:id', obtenerLaborPorId);

router.put('/actualizarLabor/:id',verificar_estado,
    verificar_trabajador,
    verificar_especialidad,
    verificar_obra, validarFechasRealesObra, verificar_usuario , actualizarLabor);

router.delete('/darDeBaja/:id', darDeBajaLabor);
router.put('/cambiarEstadoLabor/:id', cambiarEstadoLabor)


module.exports = router;