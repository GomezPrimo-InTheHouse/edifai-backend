const express = require('express');
const { registrarActividad, modificarActividad, verActividades } = require('../../controllers/actividad/actividad.controller');
const router = express.Router();


router.post('/registrar', registrarActividad)
router.put('/editar/:id', modificarActividad) 
router.get('/verActividades', verActividades )
module.exports = router; // Exportar el router para que pueda ser utilizado en otros archivos