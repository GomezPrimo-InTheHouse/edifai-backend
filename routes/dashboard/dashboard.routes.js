const express = require('express');
const router  = express.Router();
const { verificarToken } = require('../../middlewares/autorizacionDeRoles');
const { getDashboardAdmin, getDashboardTrabajador } = require('../../controllers/dashboard/dashboard.controller');

router.get('/admin',      verificarToken, getDashboardAdmin);
router.get('/trabajador', verificarToken, getDashboardTrabajador);

module.exports = router;