express = require('express');
const router = express.Router();
const { registerarEvento, modificarEvento, bajaDeEvento } = require('../../controllers/register/evento.controller.js');

// Registrar un nuevo evento
router.post('/register', registerarEvento);
// Modificar un evento existente
router.put('/modificar/:id', modificarEvento);
// Dar de baja un evento
router.delete('/delete/:id', bajaDeEvento);




module.exports = router; // Exportar el router para que pueda ser utilizado en otros archivos