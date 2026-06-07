const router = require('express').Router();
const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');
const {
  publicarMaterial,
  getPublicaciones,
  getMisPublicaciones,
  cancelarPublicacion,
  iniciarTransaccion,
  actualizarTransaccion,
  getMisTransacciones,
  getMensajes,
  enviarMensaje,
  marcarLeidos,
  getMensajesNoLeidos,
  getInbox
} = require('../../controllers/market/market.controller.js');

// Publicaciones
router.post('/publicaciones', verificarToken, publicarMaterial);
router.get('/publicaciones', verificarToken, getPublicaciones);
router.get('/publicaciones/mis', verificarToken, getMisPublicaciones);
router.put('/publicaciones/:id/cancelar', verificarToken, cancelarPublicacion);

// Transacciones
router.post('/transacciones', verificarToken, iniciarTransaccion);
router.put('/transacciones/:id', verificarToken, actualizarTransaccion);
router.get('/transacciones/mis', verificarToken, getMisTransacciones);
router.get('/transacciones/inbox', verificarToken, getInbox);
// Mensajes
router.get('/mensajes/no-leidos', verificarToken, getMensajesNoLeidos);
router.get('/mensajes/:transaccion_id', verificarToken, getMensajes);
router.post('/mensajes/:transaccion_id', verificarToken, enviarMensaje);
router.put('/mensajes/leer/:transaccion_id', verificarToken, marcarLeidos);


module.exports = router;