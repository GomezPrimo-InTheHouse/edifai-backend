const express = require('express');
const router  = express.Router();
const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');
const { obtenerPendientes, obtenerRecomendacionesIA, obtenerConfig, actualizarConfig } =
  require('../../controllers/resumen/resumen.controller.js');

router.use(verificarToken);
router.get('/pendientes',           obtenerPendientes);
router.get('/recomendaciones-ia',   obtenerRecomendacionesIA);
router.get('/config',               obtenerConfig);
router.patch('/config/:modulo',     actualizarConfig);

module.exports = router;