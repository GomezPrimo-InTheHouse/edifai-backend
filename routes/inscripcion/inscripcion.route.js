const express = require('express');
const router = express.Router();
const {
    registrarParticipante,
    inscribirParticipante
} = require('../../controllers/inscripcion/inscripcion.controller.js');

// Registrar una inscripción


router.post('/registrar', registrarParticipante);
// Inscribir un participante a un evento
router.post('/inscribir', inscribirParticipante);



// Exportar el router para que pueda ser utilizado en otros archivos
module.exports = router; // Exportar el router para que pueda ser utilizado en otros archivos