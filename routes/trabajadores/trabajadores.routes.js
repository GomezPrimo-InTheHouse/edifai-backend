const Express = require('express');
const router = Express.Router();

    
const {
    getAllTrabajadores,
    createTrabajador,
    modificarTrabajador,
    darDeBajaTrabajador
} = require('../../controllers/trabajador/trabajador.controller.js');

// Controllers

//routes
router.get('/getAll', getAllTrabajadores);
router.put('/modificar/:id', modificarTrabajador);
router.post('/crear', createTrabajador); //valida que los datos esten completos
router.delete('/eliminar/:id', darDeBajaTrabajador); //valida que el trabajador exista


//exportar modulos
module.exports = router;