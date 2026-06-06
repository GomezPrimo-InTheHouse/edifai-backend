const express = require('express')
const router = express.Router();


//midlewares 
const { validarFechasObra } = require('../../middlewares/validarFechasObra.js');
const {verificar_tipo_obra, verificar_estado, verificar_usuario} = require('../../middlewares/verificarExistencias.js')
const { verificarToken } = require('../../middlewares/autorizacionDeRoles.js');

//controladores
const {createObra, getAllObras, modifyObra,
   darDeBajaObra, getObrasByEstado, getObraByID,
    getObrasByUbicacion, archivarObra, getObrasArchivadas, uploadImagenAvance} = require('../../controllers/obra/obra.controller.js')

const {  createTipoObra,
    modificarTipoDeObra,
    darDeBajaTipoObra,
    getAllTipoDeObra } = require ('../../controllers/obra/tipo-obra.controller.js')

//controllers para avance de obras

const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB para fotos de obra
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes JPG, PNG o WebP'));
  },
});

const {
  crearAvance,
  aprobarAvance,
  rechazarAvance,
  getAvancesByObra,
  guardarResultadoVision,
} = require('../../controllers/obra/avance.controller.js');

//rutas obra 
// rutas obra
router.post('/create', verificarToken, verificar_estado, verificar_usuario, verificar_tipo_obra, validarFechasObra, createObra);
router.get('/getAll', verificarToken, getAllObras);
router.get('/archivadas', verificarToken, getObrasArchivadas);
router.put('/modificar/:id', verificarToken, validarFechasObra, modifyObra);
router.delete('/delete/:id', verificarToken, darDeBajaObra);
router.put('/archivar/:id', verificarToken, archivarObra);
router.get('/getById/:id', verificarToken, getObraByID);
router.get('/getByEstado/:estado', verificarToken, getObrasByEstado);
router.get('/getByUbicacion/:ubicacion', verificarToken, getObrasByUbicacion);


//rutas tipos_de_obra
router.post('/tipoObra/create', verificarToken, createTipoObra )
router.put('/tipoObra/modificar/:id', verificarToken, modificarTipoDeObra)
router.get('/tipoObra/getAll', verificarToken, getAllTipoDeObra)
router.delete('/tipoObra/delete/:id', verificarToken, darDeBajaTipoObra)


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
// En obra.routes.js — agregar


router.post('/uploadImagenAvance', verificarToken, upload.single('imagen'), uploadImagenAvance);

module.exports = router;
