const router = require('express').Router();
const { getAllClientes,
     getClienteById, 
     createCliente, 
     updateCliente, 
     deleteCliente } = require('../../controllers/clientes/clientes.controllers.js');

router.get('/getAll', getAllClientes);
router.get('/getById/:id', getClienteById);
router.post('/create', createCliente);
router.put('/modificar/:id', updateCliente);
router.delete('/delete/:id', deleteCliente);

module.exports = router;