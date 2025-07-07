const express = require('express')
const router = express.Router();


//midlewares 
const { validarFechasObra } = require('../../middlewares/validarFechasObra.js');
const {verificar_tipo_obra, verificar_estado, verificar_usuario} = require('../../middlewares/verificarExistencias.js')

//controladores
const {createObra, getAllObras, modifyObra, darDeBajaObra, getObrasByEstado, getObraByID, getObrasByUbicacion} = require('../../controllers/obra/obra.controller.js')
const {  createTipoObra,
    modificarTipoDeObra,
    darDeBajaTipoObra,
    getAllTipoDeObra } = require ('../../controllers/obra/tipo-obra.controller.js')


//rutas obra (FALTA MIDDLEWARE PARA VERIFICAR EL ROL)
router.post('/create',verificar_estado, verificar_usuario, verificar_tipo_obra, validarFechasObra, createObra)
router.get('/getAll', getAllObras)
router.put('/modificar/:id', validarFechasObra, modifyObra) 
router.delete('/delete/:id', darDeBajaObra)

router.get('/getById/:id', getObraByID)
router.get('/getByEstado/:estado', getObrasByEstado)
router.get('/getByUbicacion/:ubicacion', getObrasByUbicacion)


//rutas tipos_de_obra
router.post('tipoObra/create', createTipoObra )
router.put('tipoObra/moficar/:id', modificarTipoDeObra)
router.get('tipoObra/getAll', getAllTipoDeObra)
router.delete('tipoObra/delete/:id', darDeBajaTipoObra)



module.exports = router;