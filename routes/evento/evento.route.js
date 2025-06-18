express = require('express');
const router = express.Router();
const { registrarEvento, modificarEvento, bajaDeEvento, buscarEventos } = require('../../controllers/register/evento.controller.js');
const { autorizacionDeRoles } = require('../../middlewares/autorizacionDeRoles.js');

const {validarFechasEvento} = require('../../middlewares/evento/validarFecha');

const {verificarEstadoExiste} = require('../../middlewares/evento/verificarEstadoExistente');
const {verificarUbicacionExiste} = require('../../middlewares/evento/verificarUbicacionExistente.js');
const {verificarConflictoDeEvento} = require('../../middlewares/evento/verificarConfictoEvento.js');

// El middleware de autorizacionDeRoles() revisará el ACCESSTOKEN, decodificará el rol del usuario y permitirá (o denegará)
//  el acceso al endpoint según el rol permitido.



// Registrar un nuevo evento
//Explicacion de la ruta /register
// Esta ruta permite a los usuarios con rol de 'admin' u 'organizador' registrar un nuevo evento en el sistema.
// Se aplican varios middlewares para validar la información del evento antes de ser registrado.
router.post('/register', autorizacionDeRoles('admin', 'organizador'), validarFechasEvento, verificarEstadoExiste, 
verificarUbicacionExiste, 
verificarConflictoDeEvento, registrarEvento);

// Modificar un evento existente
// Explicacion de la ruta /modificar/:id
// Esta ruta permite a los usuarios con rol de 'admin' u 'organizador' modificar un evento existente en el sistema.
router.put('/modificar/:id', autorizacionDeRoles('admin', 'organizador'), validarFechasEvento, verificarEstadoExiste,
verificarUbicacionExiste,
verificarConflictoDeEvento, modificarEvento);

// Dar de baja un evento
// Explicacion de la ruta /delete/:id
// Esta ruta permite a los usuarios con rol de 'admin' dar de baja un evento existente en el sistema.
//Solo modifica el estado del evento
router.post('/delete/:id', autorizacionDeRoles('admin') , bajaDeEvento);

// Buscar eventos
// Explicacion de la ruta /getAll
// Esta ruta permite a los usuarios con rol de 'admin', 'organizador' o 'usuario' buscar eventos en el sistema.

router.get('/getAll', buscarEventos)





module.exports = router; // Exportar el router para que pueda ser utilizado en otros archivos