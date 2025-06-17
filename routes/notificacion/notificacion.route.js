const express = require('express');
const router = express.Router();
const {enviarRecordatorioProximoDia,
    notificacionPorCierreDeActividad,
    enviarNotificacionModificacionActividad, } =  require('../../controllers/notificacion/notificacion.controller.js')

router.post('/recordatorio', enviarRecordatorioProximoDia)
router.post('/alertaModificacion', enviarNotificacionModificacionActividad)



module.exports = router; // Exportar el router para que pueda ser utilizado en otros archivo