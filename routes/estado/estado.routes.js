const express = require('express');

const router = express.Router();

//controladores

const {
    crearEstado,
    obtenerEstados,
    obtenerEstadoPorId,
    actualizarEstado,
    eliminarEstado,
    getEstadosPorAmbito
} = require ('../../controllers/estado/estado.controller.js')

//falta adicionar middlewares para verificar rol (solo los admin pueden acceder a estas rutas)

router.post('/create', crearEstado);
router.get('/getAll', obtenerEstados);
router.get('/getOne/:id', obtenerEstadoPorId);
router.put('/modificar/:id', actualizarEstado);
router.delete('/eliminar/:id', eliminarEstado);
router.get('/estadosPorAmbito/:ambito', getEstadosPorAmbito)

module.exports = router;