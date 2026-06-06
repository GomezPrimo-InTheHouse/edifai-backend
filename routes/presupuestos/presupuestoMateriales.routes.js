// presupuestoMateriales.routes.js - Rutas materiales por presupuesto
// TODO: Implementar rutas de materiales por presupuesto
const router = require('express').Router();
const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');
const {
  getMaterialesByPresupuesto, addMaterialToPresupuesto,
  updateCantidadMaterial, removeMaterialFromPresupuesto,
} = require('../../controllers/presupuestos/presupuestoMateriales.controller.js');

router.get('/getByPresupuesto/:presupuesto_id', verificarToken, getMaterialesByPresupuesto);
router.post('/add', verificarToken, addMaterialToPresupuesto);
router.put('/update/:id', verificarToken, updateCantidadMaterial);
router.delete('/remove/:id', verificarToken, removeMaterialFromPresupuesto);

module.exports = router;
