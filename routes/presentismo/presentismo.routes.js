const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/autorizacionDeRoles');
const {
  getMisObras,
  marcarPresentismo,
  getHistorial,
  getHistorialAdmin,
getEstadisticas,
} = require('../../controllers/presentismo/presentismo.controller');

router.get('/mis-obras',       verificarToken, getMisObras);
router.post('/marcar',         verificarToken, marcarPresentismo);
router.get('/historial',       verificarToken, getHistorial);
router.get('/historial-admin', verificarToken, getHistorialAdmin);
router.get('/estadisticas',    verificarToken, getEstadisticas);
router.get('/historial-admin', verificarToken, getHistorialAdmin);

module.exports = router;