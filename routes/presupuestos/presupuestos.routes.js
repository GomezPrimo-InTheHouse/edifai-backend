// presupuestos.routes.js - Rutas CRUD presupuestos

const router = require('express').Router();
const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');
const {
  getAllPresupuestos, getPresupuestoById,
  createPresupuesto, updatePresupuesto,
  deletePresupuesto, cambiarEstadoPresupuesto, getPresupuestoContextoPago, getPresupuestosArchivados,
  anularPresupuesto,
} = require('../../controllers/presupuestos/presupuestos.controller.js');

router.get('/getAll', verificarToken, getAllPresupuestos);
router.get('/getById/:id', verificarToken, getPresupuestoById);
router.post('/create', verificarToken, createPresupuesto);
router.get('/archivados', verificarToken, getPresupuestosArchivados); 
router.put('/modificar/:id', verificarToken, updatePresupuesto);
router.delete('/delete/:id', verificarToken, deletePresupuesto);
router.put('/cambiarEstado/:id', verificarToken, cambiarEstadoPresupuesto); 
router.get('/contextoPago/:id', verificarToken, getPresupuestoContextoPago);
router.put('/anular/:id', verificarToken, anularPresupuesto);

module.exports = router;