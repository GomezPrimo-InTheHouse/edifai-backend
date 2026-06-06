const router = require('express').Router();
const { getAllFormasPago } = require('../../controllers/pagos/formasPago.controller.js');
const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');
router.get('/getAll', verificarToken, getAllFormasPago);
module.exports = router;
