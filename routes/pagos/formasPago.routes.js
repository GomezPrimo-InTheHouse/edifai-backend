const router = require('express').Router();
const { getAllFormasPago } = require('../../controllers/pagos/formasPago.controller.js');
router.get('/getAll', getAllFormasPago);
module.exports = router;