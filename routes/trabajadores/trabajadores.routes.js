const Express = require('express');
const router = Express.Router();

const {
    getAllTrabajadores,
    createTrabajador,
    modificarTrabajador,
    darDeBajaTrabajador,
    marcarPresentismo,
    getTrabajadorById,
    getTrabajadoresByEspecialidad, // nuevo
    getJefesConEquipoPorEspecialidad // nuevo
} = require('../../controllers/trabajador/trabajador.controller.js');

router.get('/getAll', getAllTrabajadores);
router.post('/marcarPresentismo', marcarPresentismo);
router.post('/crear', createTrabajador);
router.get('/:id', getTrabajadorById);
router.put('/modificar/:id', modificarTrabajador);
router.delete('/eliminar/:id', darDeBajaTrabajador);
router.get('/getByEspecialidad/:especialidad_id', getTrabajadoresByEspecialidad); // nuevo
router.get('/getJefesConEquipo/:especialidad_id', getJefesConEquipoPorEspecialidad); // nuevo

module.exports = router;