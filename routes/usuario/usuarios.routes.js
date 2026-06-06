// routes/usuario.routes.js
const express = require("express");
const router = express.Router();
const {verificarToken} = require('../../middlewares/autorizacionDeRoles.js')
const {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  updateUsuarioPassword,
  deleteUsuario,
  regenerarTotp,
} = require("../../controllers/usuario/usuario.controller.js");
 const { obtenerPreferencias, guardarPreferencias } = require('../../controllers/usuario/usuario.controller');

// Agregar junto al resto de rutas protegidas
router.get('/preferencias', verificarToken, obtenerPreferencias);
router.put('/preferencias', verificarToken, guardarPreferencias);

router.get("/", verificarToken, getUsuarios);
router.get("/:id", verificarToken, getUsuarioById);
router.post("/create", verificarToken, createUsuario); 

router.post("/", verificarToken, createUsuario);
router.put("/:id", verificarToken, updateUsuario);
router.patch("/:id/password", verificarToken, updateUsuarioPassword);
router.delete("/:id", verificarToken, deleteUsuario);
router.post("/:id/regenerar-totp", verificarToken, regenerarTotp); // nueva ruta para regenerar TOTP

module.exports = router;
