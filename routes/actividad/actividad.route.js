const express = require('express');
const { registrarActividad, modificarActividad, verActividades, verActividadesPorExpositor } = require('../../controllers/actividad/actividad.controller');
const router = express.Router();


router.post('/registrar', verificarRole('organizador','admin'), registrarActividad)
router.put('/editar/:id',verificarRole('organizador','admin'), modificarActividad) 
router.get('/verActividades', verificarRole('organizador','admin') ,verActividades )

router.get('/verActividadPorExpositor/:id', verificarRole('expositor','organizador','admin') ,verActividadesPorExpositor)

module.exports = router; // Exportar el router para que pueda ser utilizado en otros archivos