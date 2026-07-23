const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');
const {
  crearCompra,
  obtenerCompras,
  obtenerComprasPorObra,
  obtenerCompraPorId,
  actualizarCompra,
  eliminarCompra,
  subirComprobante,
} = require('../../controllers/compras/compras.controller.js');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes JPG, PNG, WebP o PDF'));
  },
});

router.post('/',                   verificarToken, crearCompra);
router.get('/',                    verificarToken, obtenerCompras);
router.get('/obra/:obra_id',       verificarToken, obtenerComprasPorObra);
router.get('/:id',                 verificarToken, obtenerCompraPorId);
router.put('/:id',                 verificarToken, actualizarCompra);
router.delete('/:id',              verificarToken, eliminarCompra);
router.post('/comprobante/upload', verificarToken, upload.single('comprobante'), subirComprobante);

module.exports = router;