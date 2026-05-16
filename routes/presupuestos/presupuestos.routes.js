// presupuestos.routes.js - Rutas CRUD presupuestos
// TODO: Implementar rutas CRUD para presupuestos
const router = require('express').Router();
const {
  getAllPresupuestos, getPresupuestoById,
  createPresupuesto, updatePresupuesto,
  deletePresupuesto, cambiarEstadoPresupuesto, getPresupuestoContextoPago, getPresupuestosArchivados
} = require('../../controllers/presupuestos/presupuestos.controller.js');

router.get('/getAll', getAllPresupuestos);
router.get('/getById/:id', getPresupuestoById);
router.post('/create', createPresupuesto);
router.get('/archivados', getPresupuestosArchivados); 
router.put('/modificar/:id', updatePresupuesto);
router.delete('/delete/:id', deletePresupuesto);
router.put('/cambiarEstado/:id', cambiarEstadoPresupuesto); 
router.get('/contextoPago/:id', getPresupuestoContextoPago);


module.exports = router;