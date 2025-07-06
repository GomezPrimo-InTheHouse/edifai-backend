const express = require('express')
const router = express.Router();


//midlewares 
const { validarFechasObra } = require('../../middlewares/validarFechasObra.js');


//controladores
const {createObra, getAllObras, modifyObra, darDeBajaObra, getObrasByEstado, getObraByID, getObrasByUbicacion} = require('../../controllers/obra/obra.controller.js')
const {  createTipoObra,
    modificarTipoDeObra,
    darDeBajaTipoObra,
    getAllTipoDeObra } = require ('../../controllers/obra/tipo-obra.controller.js')


//rutas obra
router.post('/create', validarFechasObra, createObra)
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