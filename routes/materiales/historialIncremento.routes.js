// historialIncremento.routes.js - Rutas historial de incrementos
// TODO: Implementar rutas para historial de incrementos
const router = require('express').Router();
const {
  getHistorialByMaterial, getHistorialCompleto,
} = require('../../controllers/materiales/historialIncremento.controller.js');

const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');

router.get('/getAll', verificarToken, getHistorialCompleto);
router.get('/getByMaterial/:material_id', verificarToken, getHistorialByMaterial);

module.exports = router;
