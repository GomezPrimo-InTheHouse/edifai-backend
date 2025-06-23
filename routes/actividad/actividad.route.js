const express = require('express');
const { registrarActividad, modificarActividad, verActividades, verActividadesPorExpositor } = require('../../controllers/actividad/actividad.controller');
const router = express.Router();
const { autorizacionDeRoles } = require('../../middlewares/autorizacionDeRoles.js');
const { verificarSalaExiste } = require('../../middlewares/evento/verificarSalaExistente.js');

const { autenticacionConRefreshAutomatica } = require('../../middlewares/autenticacionConRefreshAutomatica.js');
// const { autenticacionConRefreshAutomatica } = require('../../middlewares/authConRefresh.js');
router.post('/registrar', autenticacionConRefreshAutomatica ,
     autorizacionDeRoles('organizador','admin'), 
     verificarSalaExiste, registrarActividad)

router.put('/editar/:id',autenticacionConRefreshAutomatica,
    autorizacionDeRoles('organizador','admin'), modificarActividad) 

router.get('/verActividades', autenticacionConRefreshAutomatica,
    autorizacionDeRoles('organizador','admin') ,verActividades )

router.get('/verActividadPorExpositor/:id',autenticacionConRefreshAutomatica,
     autorizacionDeRoles('expositor','organizador','admin') ,verActividadesPorExpositor)

module.exports = router; // Exportar el router para que pueda ser utilizado en otros archivos