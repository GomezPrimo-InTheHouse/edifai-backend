const express = require('express')
const router = express.Router();


//midlewares 
const { validarFechasObra } = require('../../middlewares/validarFechasObra.js');


//controladores

const {createObra, getAllObras, modifyObra, darDeBajaObra, modifyObra, getObrasByEstado, getObraByID, getObrasByUbicacion} = require('../../controllers/obra/obra.controller.js')

router.post('/create', validarFechasObra, createObra)
router.get('/getAll', getAllObras)
router.put('/modificar/:id', validarFechasObra, modifyObra) 
router.delete('/delete/:id', darDeBajaObra)

router.get('/getById/:id', getObraByID)
router.get('/getByEstado/:estado', getObrasByEstado)
router.get('/getByUbicacion/:ubicacion', getObrasByUbicacion)





module.exports = router;