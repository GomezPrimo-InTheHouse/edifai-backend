// gastoImprevisto.routes.js
const express = require('express');
const router = express.Router();
const { autorizacionDeRoles, verificarToken } = require('../middleware/auth.middleware.js');
const {
  crearGastoImprevisto,
  obtenerGastosImprevistos,
  obtenerGastosPorObra,
  obtenerGastoImprevistoPorId,
  actualizarEstadoGasto,
  eliminarGastoImprevisto,
} = require('../controllers/gastoImprevisto.controller.js');

// Cualquier usuario autenticado puede crear y consultar
router.post('/',                       verificarToken, crearGastoImprevisto);
router.get('/',                        verificarToken, obtenerGastosImprevistos);
router.get('/obra/:obra_id',           verificarToken, obtenerGastosPorObra);
router.get('/:id',                     verificarToken, obtenerGastoImprevistoPorId);

// Solo Admin puede cambiar estado o eliminar
router.patch('/:id/estado',            autorizacionDeRoles(1), actualizarEstadoGasto);
router.delete('/:id',                  autorizacionDeRoles(1), eliminarGastoImprevisto);

module.exports = router;