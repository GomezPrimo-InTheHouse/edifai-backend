const router = require('express').Router();
const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');
const {
  obtenerSectoresPorObra,
  crearSector,
  crearSectoresBulk,
  actualizarSector,
  eliminarSector,
} = require('../../controllers/sectores/sectores.controller.js');

router.get('/byObra/:obra_id', verificarToken, obtenerSectoresPorObra);
router.post('/create',         verificarToken, crearSector);
router.post('/bulk',           verificarToken, crearSectoresBulk);
router.put('/modificar/:id',   verificarToken, actualizarSector);
router.delete('/delete/:id',   verificarToken, eliminarSector);

module.exports = router;