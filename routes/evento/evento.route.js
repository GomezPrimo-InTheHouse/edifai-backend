express = require('express');
const router = express.Router();
const { registerarEvento, modificarEvento, bajaDeEvento, buscarEventos } = require('../../controllers/register/evento.controller.js');
const { autorizacionDeRoles, verificarEventoExistente } = require('../../middlewares/eventos/varificarAdmin.js');



// El middleware de autorizacionDeRoles() revisará el ACCESSTOKEN, decodificará el rol del usuario y permitirá (o denegará)
//  el acceso al endpoint según el rol permitido.

// Recordando lo que se firma en los tokens:

//  const accessToken = jwt.sign(
//       { userId: usuario.id, 
//         email: usuario.email, 
//         rol: usuario.rol },
//       process.env.JWT_SECRET,
//       { expiresIn: '1h' }
//     );

// Registrar un nuevo evento
router.post('/register' , registerarEvento);
// Modificar un evento existente
router.put('/modificar/:id', autorizacionDeRoles('admin', 'organizador') , modificarEvento);
// Dar de baja un evento
router.post('/delete/:id', autorizacionDeRoles('admin') , bajaDeEvento);

router.get('/getAll', buscarEventos)





module.exports = router; // Exportar el router para que pueda ser utilizado en otros archivos