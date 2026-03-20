// presupuestoMateriales.routes.js - Rutas materiales por presupuesto
// TODO: Implementar rutas de materiales por presupuesto
const router = require('express').Router();
const {
  getMaterialesByPresupuesto, addMaterialToPresupuesto,
  updateCantidadMaterial, removeMaterialFromPresupuesto,
} = require('../../controllers/presupuestos/presupuestoMateriales.controller.js');

router.get('/getByPresupuesto/:presupuesto_id', getMaterialesByPresupuesto);
router.post('/add', addMaterialToPresupuesto);
router.put('/update/:id', updateCantidadMaterial);
router.delete('/remove/:id', removeMaterialFromPresupuesto);

module.exports = router;