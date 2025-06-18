const express = require('express');
const router = express.Router();
const {
    registrarParticipante,
    inscribirParticipante,
    verParticipantes,
    getAllTiposInscripcion
} = require('../../controllers/inscripcion/inscripcion.controller.js');
const { autorizacionDeRoles } = require('../../middlewares/autorizacionDeRoles.js');
// Registrar una inscripción


router.post('/registrar',autorizacionDeRoles('asistente','admin','organizador'), registrarParticipante);
// Inscribir un participante a un evento
router.post('/inscribir',autorizacionDeRoles('asistente','admin','organizador') ,inscribirParticipante);
router.get('/tipos-inscripcion', getAllTiposInscripcion)
router.get('/verParticipantes', verParticipantes);


// Exportar el router para que pueda ser utilizado en otros archivos
module.exports = router; 