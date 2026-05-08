// routes/usuario.routes.js
const express = require("express");
const router = express.Router();

const {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  updateUsuarioPassword,
  deleteUsuario,
  regenerarTotp,
} = require("../../controllers/usuario/usuario.controller.js");

router.get("/", getUsuarios);
router.get("/:id", getUsuarioById);
router.post("/create", createUsuario); 

router.post("/", createUsuario);
router.put("/:id", updateUsuario);
router.patch("/:id/password", updateUsuarioPassword);
router.delete("/:id", deleteUsuario);
router.post("/:id/regenerar-totp", regenerarTotp); // nueva ruta para regenerar TOTP

module.exports = router;
