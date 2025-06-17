//Dependencias
express = require('express');
const router = express.Router();
//controllers
const {login} = require('../../controllers/auth/login.controller.js');
const {logout} = require('../../controllers/auth/logout.controller.js');
const {darDeBajaUsuario} = require('../../controllers/auth/deleteUser.controller.js');
const {register, obtenerUsuarios } = require('../../controllers/auth/register.controller.js');
const { refreshAccessToken } = require('../../controllers/auth/authWithRefresh.controller.js');
//middlewares
const { basicAuth } = require('../../middlewares/basicAuth.js');
const { autorizacionDeRoles } = require('../../middlewares/autorizacionDeRoles.js');

// El middleware de autorizacionDeRoles() revisará el ACCESSTOKEN, decodificará el rol del usuario y permitirá (o denegará)
//  el acceso al endpoint según el rol permitido.
// Recordando lo que se firma en los tokens:
// const accessToken = jwt.sign(
//       { userId: usuario.id,
//         email: usuario.email,
//         rol: usuario.rol },
//       process.env.JWT_SECRET,
//       { expiresIn: '1h' }
//     );

router.post('/register', autorizacionDeRoles('admin'), register);

router.post('/login', basicAuth, login)

router.post('/logout', logout) 

router.post('/darDeBaja/:id', autorizacionDeRoles('admin'), darDeBajaUsuario)



router.post('/refresh-token', refreshAccessToken)

router.get('/obtenerUsuarios', obtenerUsuarios)


module.exports = router;