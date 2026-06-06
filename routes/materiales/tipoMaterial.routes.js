// tipoMaterial.routes.js - Rutas CRUD tipos de material
// TODO: Implementar rutas CRUD para tipos de material
const router = require('express').Router();
const {
  getAllTiposMaterial, createTipoMaterial, deleteTipoMaterial,
} = require('../../controllers/materiales/tipoMaterial.controller.js');

const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');

router.get('/getAll', verificarToken, getAllTiposMaterial);
router.post('/create', verificarToken, createTipoMaterial);
router.delete('/delete/:id', verificarToken, deleteTipoMaterial);

module.exports = router;
