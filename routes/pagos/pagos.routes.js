const router = require('express').Router();
const {
  getAllPagos, getPagoById, createPago, updatePago,
  deletePago, cambiarEstadoPago, getPagosByTrabajador, getPagosByPresupuesto,
  getEstadisticasPagos
} = require('../../controllers/pagos/pagos.controller.js');

const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');

router.get('/getAll', verificarToken, getAllPagos);
router.get('/getById/:id', verificarToken, getPagoById);
router.get('/getByTrabajador/:trabajador_id', verificarToken, getPagosByTrabajador);
router.get('/getByPresupuesto/:presupuesto_id', verificarToken, getPagosByPresupuesto);
router.post('/create', verificarToken, createPago);
router.put('/modificar/:id', verificarToken, updatePago);
router.put('/cambiarEstado/:id', verificarToken, cambiarEstadoPago);
router.delete('/delete/:id', verificarToken, deletePago);
router.get('/estadisticas', verificarToken, getEstadisticasPagos);
module.exports = router;
