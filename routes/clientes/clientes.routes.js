const router = require('express').Router();
const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');
const { getAllClientes, getClienteById, createCliente, updateCliente, deleteCliente } = require('../../controllers/clientes/clientes.controllers.js');

router.get('/getAll', verificarToken, getAllClientes);
router.get('/getById/:id', verificarToken, getClienteById);
router.post('/create', verificarToken, createCliente);
router.put('/modificar/:id', verificarToken, updateCliente);
router.delete('/delete/:id', verificarToken, deleteCliente);

module.exports = router;