const express = require('express')
const router = express.Router();


//midlewares 
const { validarFechasObra } = require('../../middlewares/validarFechasObra.js');


//controladores

const {createObra, getAllObras,modificarObra,darDeBajaObra,modifyObra} = require('../../controllers/obra/obra.controller.js')

router.post('/create', validarFechasObra, createObra)
router.get('/getAll', getAllObras)
router.put('/modificar/:id', modifyObra) 
router.delete('/delete/:id', darDeBajaObra)


module.exports = router;