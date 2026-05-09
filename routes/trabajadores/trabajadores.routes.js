const Express = require('express');
const router = Express.Router();

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

router.get('/getAll',                              getAllTrabajadores);
router.post('/marcarPresentismo',                  marcarPresentismo);
router.post('/crear',                              createTrabajador);
router.get('/getByEspecialidad/:especialidad_id',  getTrabajadoresByEspecialidad);  // ← antes de /:id
router.get('/getJefesConEquipo/:especialidad_id',  getJefesConEquipoPorEspecialidad); // ← antes de /:id
router.put('/modificar/:id',                       modificarTrabajador);
router.delete('/eliminar/:id',                     darDeBajaTrabajador);
router.get('/:id',                                 getTrabajadorById);  // ← siempre al final

module.exports = router;