const router = require('express').Router();
const {
  getAllPagos, getPagoById, createPago, updatePago,
  deletePago, cambiarEstadoPago, getPagosByTrabajador, getPagosByPresupuesto,
  getEstadisticasPagos
} = require('../../controllers/pagos/pagos.controller.js');

router.get('/getAll', getAllPagos);
router.get('/getById/:id', getPagoById);
router.get('/getByTrabajador/:trabajador_id', getPagosByTrabajador);
router.get('/getByPresupuesto/:presupuesto_id', getPagosByPresupuesto);
router.post('/create', createPago);
router.put('/modificar/:id', updatePago);
router.put('/cambiarEstado/:id', cambiarEstadoPago);
router.delete('/delete/:id', deletePago);
router.get('/estadisticas', getEstadisticasPagos);
module.exports = router;