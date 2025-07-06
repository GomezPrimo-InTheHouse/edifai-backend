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
const validarCreedenciales  = require('../../middlewares/validarCredenciales.js')
const verificarTotpSiCorresponde = require('../../middlewares/verificarTotpSiCorresponde.js')


//Explicacion de la ruta /register en README.md
router.post('/register', register);

//1 ) se valida mediante authBasic las credenciales y el rol, luego se pasan a
//2) verficarTotp para determinar mediante el rol, si es necesatio proporcionarle un TOTP
// o si no es necesario un TOTP.


router.post('/login', validarCreedenciales, verificarTotpSiCorresponde, login) 



router.post('/refresh-token', refreshAccessToken)

router.post('/logout', logout) 

router.post('/darDeBaja/:id', autorizacionDeRoles('admin'), darDeBajaUsuario)


router.get('/obtenerUsuarios', obtenerUsuarios)


module.exports = router;