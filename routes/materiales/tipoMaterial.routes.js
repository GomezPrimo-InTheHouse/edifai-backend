// tipoMaterial.routes.js - Rutas CRUD tipos de material
// TODO: Implementar rutas CRUD para tipos de material
const router = require('express').Router();
const {
  getAllTiposMaterial, createTipoMaterial, deleteTipoMaterial,
} = require('../../controllers/materiales/tipoMaterial.controller.js');

router.get('/getAll', getAllTiposMaterial);
router.post('/create', createTipoMaterial);
router.delete('/delete/:id', deleteTipoMaterial);

module.exports = router;