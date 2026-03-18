const Express = require('express');
const router = Express.Router();

    
const {
    getAllTrabajadores,
    createTrabajador,
    modificarTrabajador,
    darDeBajaTrabajador,
    marcarPresentismo
} = require('../../controllers/trabajador/trabajador.controller.js');

// Controllers

//routes
router.get('/getAll', getAllTrabajadores);
router.put('/modificar/:id', modificarTrabajador);
router.post('/crear', createTrabajador); //valida que los datos esten completos
router.delete('/eliminar/:id', darDeBajaTrabajador); //valida que el trabajador exista
router.post('/marcarPresentismo', marcarPresentismo); 
// Registra la asistencia de un trabajador autenticado a una obra.
// Valida que:
// - exista un trabajador asociado al usuario autenticado
// - la obra exista
// - el trabajador esté asignado a esa obra
// - la geolocalización enviada esté dentro del rango permitido para marcar asistencia


//exportar modulos
module.exports = router;