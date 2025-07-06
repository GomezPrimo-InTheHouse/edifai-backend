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

router.post('/crear', crearLabor);
router.get('/getAll', obtenerLabores);
router.get('getOne/:id', obtenerLaborPorId);
router.put('modificar/:id', actualizarLabor);
router.delete('darDeBaja/:id', darDeBajaLabor);
router.put('/cambiarEstadoLabor/:id', cambiarEstadoLabor)


module.exports = router;