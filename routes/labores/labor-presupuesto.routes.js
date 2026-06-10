// const express = require('express');
// const router = express.Router();
// const { verificarToken, autorizacionDeRoles } = require('../../middlewares/autorizacionDeRoles.js');
// const {
//   listarPresupuestos,
//   agregarPresupuesto,
//   seleccionarPresupuesto,
//   eliminarPresupuesto,
// } = require('../../controllers/labores/laborPresupuestos.controller.js');

// const ROLES_ADMIN = [1, 3, 4, 6, 9];

// router.get('/:labor_id', verificarToken, autorizacionDeRoles(...ROLES_ADMIN), listarPresupuestos);
// router.post('/:labor_id', verificarToken, autorizacionDeRoles(...ROLES_ADMIN), agregarPresupuesto);
// router.put('/:id/seleccionar', verificarToken, autorizacionDeRoles(...ROLES_ADMIN), seleccionarPresupuesto);
// router.delete('/:id', verificarToken, autorizacionDeRoles(...ROLES_ADMIN), eliminarPresupuesto);

// module.exports = router;

const express = require('express');
const router = express.Router();
const { verificarToken, autorizacionDeRoles } = require('../../middlewares/autorizacionDeRoles.js');
const {
  listarPresupuestos,
  agregarPresupuesto,
  seleccionarPresupuesto,
  eliminarPresupuesto,
listarUnidades
} = require('../../controllers/labores/laborPresupuestos.controller.js');

const ROLES_ADMIN = [1, 3, 4, 6, 9];

router.get('/unidades-medida', verificarToken, listarUnidades);
router.get('/:labor_id', verificarToken, autorizacionDeRoles(...ROLES_ADMIN), listarPresupuestos);
router.post('/:labor_id', verificarToken, autorizacionDeRoles(...ROLES_ADMIN), agregarPresupuesto);
router.put('/:id/seleccionar', verificarToken, autorizacionDeRoles(...ROLES_ADMIN), seleccionarPresupuesto);
router.delete('/:id', verificarToken, autorizacionDeRoles(...ROLES_ADMIN), eliminarPresupuesto);

module.exports = router;