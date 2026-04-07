const router = require('express').Router();
router.use('/pagos', require('./pagos.routes.js'));
router.use('/formasPago', require('./formasPago.routes.js'));
module.exports = router;