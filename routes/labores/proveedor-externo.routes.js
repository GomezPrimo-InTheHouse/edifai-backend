// routes/proveedores-externos.routes.js
const express = require('express');
const router = express.Router();
const { verificarToken, autorizacionDeRoles } = require('../../middlewares/autorizacionDeRoles.js');

const { listarProveedores, crearProveedor, vincularTrabajador } 
= require('../../controllers/labores/proveedoresExternos.controller.js');



const ROLES_ADMIN = [1, 3, 4, 6, 9];

router.get('/', verificarToken, autorizacionDeRoles(...ROLES_ADMIN), listarProveedores);
router.post('/', verificarToken, autorizacionDeRoles(...ROLES_ADMIN), crearProveedor);
router.put('/:id/vincular-trabajador', verificarToken, autorizacionDeRoles(...ROLES_ADMIN), vincularTrabajador);
module.exports = router;