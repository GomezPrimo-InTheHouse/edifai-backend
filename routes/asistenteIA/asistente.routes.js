

const express = require('express');
const router = express.Router();
const {verificarToken} = require('../../middlewares/autorizacionDeRoles.js'); // ajustar path real

const { enviarMensaje, obtenerSesiones, obtenerMensajes, eliminarSesion } = require('../../controllers/asistenteIA/asistente.controller.js');

router.use(verificarToken);
router.post('/mensaje', enviarMensaje);
router.get('/sesiones', obtenerSesiones);
router.get('/sesiones/:id/mensajes', obtenerMensajes);
router.delete('/sesiones/:id', eliminarSesion);

module.exports = router;