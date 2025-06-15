const express = require('express');
const router = express.Router();
const {enviarRecordatorioProximoDia,
    notificacionPorCierreDeActividad,
    enviarNotificacionModificacionActividad, } =  require('../../controllers/notificacion/notificacion.controller.js')

// router.post('/enviarRecordatorioProximoDia', enviarRecordatorioProximoDia)
// router.post('/notificacionPorCierreDeActividad', notificacionPorCierreDeActividad)
router.post('/enviarNotificacionModificacionActividad', enviarNotificacionModificacionActividad)



module.exports = router; // Exportar el router para que pueda ser utilizado en otros archivo