
//routes/materiales/materiales.routes.js

const router = require('express').Router();
const {
  getAllMateriales, getMaterialById, createMaterial,
  updateMaterial, deleteMaterial, ajustePreciosMasivo,
  getEstadisticasMateriales, // nuevo controlador para estadísticas
} = require('../../controllers/materiales/materiales.controller.js');
const multer = require('multer');
const { uploadImagenMaterial } = require('../../controllers/materiales/uploadImagen.controller.js');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes JPG, PNG o WebP'));
  },
});

const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');

router.get('/getAll', verificarToken, getAllMateriales);
router.post('/upload-imagen', verificarToken, upload.single('imagen'), uploadImagenMaterial);
router.get('/getById/:id', verificarToken, getMaterialById);
router.post('/create', verificarToken, createMaterial);
router.get('/estadisticas', verificarToken, getEstadisticasMateriales);
router.put('/modificar/:id', verificarToken, updateMaterial);
router.delete('/delete/:id', verificarToken, deleteMaterial);
router.put('/ajustePrecios', verificarToken, ajustePreciosMasivo); // ajuste masivo de precios

module.exports = router;
