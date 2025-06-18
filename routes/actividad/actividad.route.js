const express = require('express');
const { registrarActividad, modificarActividad, verActividades, verActividadesPorExpositor } = require('../../controllers/actividad/actividad.controller');
const router = express.Router();
const { autorizacionDeRoles } = require('../../middlewares/autorizacionDeRoles.js');
const { verificarSalaExiste } = require('../../middlewares/evento/verificarSalaExistente.js');

router.post('/registrar', autorizacionDeRoles('organizador','admin'), verificarSalaExiste, registrarActividad)

router.put('/editar/:id',autorizacionDeRoles('organizador','admin'), modificarActividad) 

router.get('/verActividades', autorizacionDeRoles('organizador','admin') ,verActividades )

router.get('/verActividadPorExpositor/:id', autorizacionDeRoles('expositor','organizador','admin') ,verActividadesPorExpositor)

module.exports = router; // Exportar el router para que pueda ser utilizado en otros archivos