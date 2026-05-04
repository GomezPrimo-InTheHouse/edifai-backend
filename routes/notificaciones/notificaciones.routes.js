const express = require('express');
const router = express.Router();
const {
  getNotificaciones,
  crearNotificacionInterna,
  marcarLeida,
  marcarTodasLeidas,
  sseStream,
} = require('../../controllers/notificaciones/notificaciones.controller');
const { verificarToken } = require('../../middlewares/autorizacionDeRoles');

// SSE — stream tiempo real (requiere auth)
router.get('/sse', sseStream);

// CRUD
router.get('/',           verificarToken, getNotificaciones);
router.post('/interna',   crearNotificacionInterna); // llamada interna entre microservicios
router.patch('/:id/leer', verificarToken, marcarLeida);
router.patch('/leer-todas', verificarToken, marcarTodasLeidas);

module.exports = router;