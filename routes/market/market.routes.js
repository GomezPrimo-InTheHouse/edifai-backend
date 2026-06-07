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
  getInbox,
  subirComprobante
} = require('../../controllers/market/market.controller.js');
const multer = require('multer');

const uploadComprobante = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes JPG, PNG, WebP o HEIC'));
  },
});

// Publicaciones
router.post('/publicaciones', verificarToken, publicarMaterial);
router.get('/publicaciones', verificarToken, getPublicaciones);
router.get('/publicaciones/mis', verificarToken, getMisPublicaciones);
router.put('/publicaciones/:id/cancelar', verificarToken, cancelarPublicacion);

// Transaccioness
router.post('/transacciones', verificarToken, iniciarTransaccion);
router.put('/transacciones/:id', verificarToken, actualizarTransaccion);
router.get('/transacciones/mis', verificarToken, getMisTransacciones);
router.get('/transacciones/inbox', verificarToken, getInbox);
// Mensajes
router.get('/mensajes/no-leidos', verificarToken, getMensajesNoLeidos);
router.get('/mensajes/:transaccion_id', verificarToken, getMensajes);
router.post('/mensajes/:transaccion_id', verificarToken, enviarMensaje);
router.put('/mensajes/leer/:transaccion_id', verificarToken, marcarLeidos);

router.post('/comprobante/:transaccion_id', verificarToken, uploadComprobante.single('comprobante'), subirComprobante);

module.exports = router;