const express = require('express')
const router = express.Router();


//midlewares 
const { validarFechasObra } = require('../../middlewares/validarFechasObra.js');
const {verificar_tipo_obra, verificar_estado, verificar_usuario} = require('../../middlewares/verificarExistencias.js')
const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');

//controladores
const {createObra, getAllObras, modifyObra, darDeBajaObra, getObrasByEstado, getObraByID, getObrasByUbicacion} = require('../../controllers/obra/obra.controller.js')
const {  createTipoObra,
    modificarTipoDeObra,
    darDeBajaTipoObra,
    getAllTipoDeObra } = require ('../../controllers/obra/tipo-obra.controller.js')
//controllers para avance de obras

const {
  crearAvance,
  aprobarAvance,
  rechazarAvance,
  getAvancesByObra,
  guardarResultadoVision,
} = require('../../controllers/obra/avance.controller.js');

//rutas obra (FALTA MIDDLEWARE PARA VERIFICAR EL ROL)
router.post('/create', verificar_estado, verificar_usuario, verificar_tipo_obra, validarFechasObra, createObra)
router.get('/getAll', getAllObras)
router.put('/modificar/:id', validarFechasObra, modifyObra) 
router.delete('/delete/:id', darDeBajaObra)

router.get('/getById/:id', getObraByID)
router.get('/getByEstado/:estado', getObrasByEstado)
router.get('/getByUbicacion/:ubicacion', getObrasByUbicacion)


//rutas tipos_de_obra
router.post('/tipoObra/create', createTipoObra )
router.put('/tipoObra/modificar/:id', modificarTipoDeObra)
router.get('/tipoObra/getAll', getAllTipoDeObra)
router.delete('/tipoObra/delete/:id', darDeBajaTipoObra)


//rutas avances de obra:
// Verificación de roles: se maneja dentro de cada controller
// siguiendo la convención del proyecto (no hay middleware de rol en la ruta)
 
router.post('/crearAvance',            verificarToken, crearAvance);
router.put('/:id/aprobar',       verificarToken, aprobarAvance);
router.put('/:id/rechazar',      verificarToken, rechazarAvance);
router.get('/getByObra',         verificarToken, getAvancesByObra);
 
// Ruta de uso interno — proteger con API key de microservicio cuando se implemente la IA
// Por ahora queda disponible para pruebas, igual que el resto del sistema
router.put('/:id/vision',        verificarToken, guardarResultadoVision);


module.exports = router;