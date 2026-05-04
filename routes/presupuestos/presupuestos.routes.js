// presupuestos.routes.js - Rutas CRUD presupuestos
// TODO: Implementar rutas CRUD para presupuestos
const router = require('express').Router();
const {
  getAllPresupuestos, getPresupuestoById,
  createPresupuesto, updatePresupuesto,
  deletePresupuesto, cambiarEstadoPresupuesto, getPresupuestoContextoPago
} = require('../../controllers/presupuestos/presupuestos.controller.js');

router.get('/getAll', getAllPresupuestos);
router.get('/getById/:id', getPresupuestoById);
router.post('/create', createPresupuesto);
router.put('/modificar/:id', updatePresupuesto);
router.delete('/delete/:id', deletePresupuesto);
router.put('/cambiarEstado/:id', cambiarEstadoPresupuesto); // confirmar presupuesto → decrementa stock
router.get('/contextoPago/:id', getPresupuestoContextoPago);

module.exports = router;