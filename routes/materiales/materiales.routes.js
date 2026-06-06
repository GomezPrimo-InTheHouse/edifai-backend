
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

router.get('/getAll', getAllMateriales);
router.post('/upload-imagen', upload.single('imagen'), uploadImagenMaterial);
router.get('/getById/:id', getMaterialById);
router.post('/create', createMaterial);
router.get('/estadisticas', getEstadisticasMateriales);
router.put('/modificar/:id', updateMaterial);
router.delete('/delete/:id', deleteMaterial);
router.put('/ajustePrecios', ajustePreciosMasivo); // ajuste masivo de precios

module.exports = router;