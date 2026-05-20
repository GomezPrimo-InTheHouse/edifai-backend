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

router.get("/", getUsuarios);
router.get("/:id", getUsuarioById);
router.post("/create", createUsuario); 

router.post("/", createUsuario);
router.put("/:id", updateUsuario);
router.patch("/:id/password", updateUsuarioPassword);
router.delete("/:id", deleteUsuario);
router.post("/:id/regenerar-totp", regenerarTotp); // nueva ruta para regenerar TOTP

module.exports = router;
