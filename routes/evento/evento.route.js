express = require('express');
const router = express.Router();
const { registerarEvento, modificarEvento, bajaDeEvento, buscarEventos } = require('../../controllers/register/evento.controller.js');
const { autorizacionDeRoles } = require('../../middlewares/autorizacionDeRoles.js');

const {validarFechasEvento} = require('../../middlewares/evento/validarFecha');
const {verificarSalaExiste} = require('../../middlewares/evento/verificarSalaExistente.js');
const {verificarEstadoExiste} = require('../../middlewares/evento/verificarEstadoExistente');
const {verificarUbicacionExiste} = require('../../middlewares/evento/verificarUbicacionExistente.js');
const {verificarConflictoDeEvento} = require('../../middlewares/evento/verificarConfictoEvento.js');

// El middleware de autorizacionDeRoles() revisará el ACCESSTOKEN, decodificará el rol del usuario y permitirá (o denegará)
//  el acceso al endpoint según el rol permitido.



// Registrar un nuevo evento
router.post('/register', autorizacionDeRoles('admin', 'organizador'), validarFechasEvento, 
verificarSalaExiste, verificarEstadoExiste, 
verificarUbicacionExiste, 
verificarConflictoDeEvento, registerarEvento);

// Modificar un evento existente
router.put('/modificar/:id', autorizacionDeRoles('admin', 'organizador'), validarFechasEvento,
verificarSalaExiste, verificarEstadoExiste,
verificarUbicacionExiste,
verificarConflictoDeEvento, modificarEvento);

// Dar de baja un evento
router.post('/delete/:id', autorizacionDeRoles('admin') , bajaDeEvento);

// Buscar eventos
router.get('/getAll', buscarEventos)





module.exports = router; // Exportar el router para que pueda ser utilizado en otros archivos