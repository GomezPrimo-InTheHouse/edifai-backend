// historialIncremento.routes.js - Rutas historial de incrementos
// TODO: Implementar rutas para historial de incrementos
const router = require('express').Router();
const {
  getHistorialByMaterial, getHistorialCompleto,
} = require('../../controllers/materiales/historialIncremento.controller.js');

router.get('/getAll', getHistorialCompleto);
router.get('/getByMaterial/:material_id', getHistorialByMaterial);

module.exports = router;