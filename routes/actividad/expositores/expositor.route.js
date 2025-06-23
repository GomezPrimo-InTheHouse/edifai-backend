const {verActividades, verPerfilExpositor} = require('../../../controllers/expositores/expositores.controller.js')
const express = require('express');
const router = express.Router();
const { autorizacionDeRoles } = require('../../../middlewares/autorizacionDeRoles.js');

// El middleware de autorizacionDeRoles() revisará el ACCESSTOKEN, decodificará el rol del usuario y permitirá (o denegará)
//  el acceso al endpoint según el rol permitido.
// Recordando lo que se firma en los tokens:

const { autenticacionConRefreshAutomatica } = require('../../../middlewares/autenticacionConRefreshAutomatica.js');

router.get('/verActividades/:id', autenticacionConRefreshAutomatica
    ,autorizacionDeRoles('expositor', 'organizador', 'admin'), verActividades);
router.get('/verPerfilExpositor/:id',autenticacionConRefreshAutomatica,
     autorizacionDeRoles('expositor', 'organizador', 'admin'), verPerfilExpositor);

// Exportar el router para que pueda ser utilizado en otros archivos
module.exports = router;