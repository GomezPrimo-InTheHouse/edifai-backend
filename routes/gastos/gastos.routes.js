// gastos.routes.js
const express = require('express');
const router = express.Router();
const { autorizacionDeRoles, verificarToken } = require('../../middlewares/autorizacionDeRoles.js');
const {
  crearGastoImprevisto,
  obtenerGastosImprevistos,
  obtenerGastosPorObra,
  obtenerGastoImprevistoPorId,
  actualizarEstadoGasto,
  eliminarGastoImprevisto,
  actualizarDeudorGasto,
  subirTicket
} = require('../../controllers/gastos/gastos.controller.js');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — tickets pueden ser PDFs pesados
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes JPG, PNG, WebP o PDF'));
  },
});
// Cualquier usuario autenticado puede crear y consultar
router.post('/',                       verificarToken, crearGastoImprevisto);
router.get('/',                        verificarToken, obtenerGastosImprevistos);
router.get('/obra/:obra_id',           verificarToken, obtenerGastosPorObra);
router.get('/:id',                     verificarToken, obtenerGastoImprevistoPorId);

// Solo Admin puede cambiar estado o eliminar
router.patch('/:id/estado',            autorizacionDeRoles(1), actualizarEstadoGasto);
router.patch('/:id/deudor', verificarToken, actualizarDeudorGasto);
router.delete('/:id',                  autorizacionDeRoles(1), eliminarGastoImprevisto);

//route para subir el ticket
router.post('/ticket/upload', verificarToken, upload.single('ticket'), subirTicket);

module.exports = router;