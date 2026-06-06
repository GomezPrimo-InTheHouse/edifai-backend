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
const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');

router.post('/create', verificarToken, crearEstado);
router.get('/getAll', verificarToken, obtenerEstados);
router.get('/getOne/:id', verificarToken, obtenerEstadoPorId);
router.put('/modificar/:id', verificarToken, actualizarEstado);
router.delete('/eliminar/:id', verificarToken, eliminarEstado);
router.get('/estadosPorAmbito/:ambito', verificarToken, getEstadosPorAmbito)

module.exports = router;
