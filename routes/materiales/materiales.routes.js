// materiales.routes.js - Rutas CRUD de materiales
// TODO: Implementar rutas CRUD para materiales
const router = require('express').Router();
const {
  getAllMateriales, getMaterialById, createMaterial,
  updateMaterial, deleteMaterial, ajustePreciosMasivo,
  getEstadisticasMateriales, // nuevo controlador para estadísticas
} = require('../../controllers/materiales/materiales.controller.js');

router.get('/getAll', getAllMateriales);
router.get('/getById/:id', getMaterialById);
router.post('/create', createMaterial);
router.get('/estadisticas', getEstadisticasMateriales);
router.put('/modificar/:id', updateMaterial);
router.delete('/delete/:id', deleteMaterial);
router.put('/ajustePrecios', ajustePreciosMasivo); // ajuste masivo de precios

module.exports = router;