const Express = require('express');
const router = Express.Router();
const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');

const {
  getAllTrabajadores,
  createTrabajador,
  modificarTrabajador,
  darDeBajaTrabajador,
  marcarPresentismo,
  getTrabajadorById,
  getTrabajadoresByEspecialidad,
  getJefesConEquipoPorEspecialidad,
} = require('../../controllers/trabajador/trabajador.controller.js');

router.get('/getAll',                              verificarToken, getAllTrabajadores);
router.post('/marcarPresentismo',                  verificarToken, marcarPresentismo);
router.post('/crear',                              verificarToken, createTrabajador);
router.get('/getByEspecialidad/:especialidad_id',  verificarToken, getTrabajadoresByEspecialidad);  // ← antes de /:id
router.get('/getJefesConEquipo/:especialidad_id',  verificarToken, getJefesConEquipoPorEspecialidad); // ← antes de /:id
router.put('/modificar/:id',                       verificarToken, modificarTrabajador);
router.delete('/eliminar/:id',                     verificarToken, darDeBajaTrabajador);
router.get('/:id',                                 verificarToken, getTrabajadorById);  // ← siempre al final

module.exports = router;
