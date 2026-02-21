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
} = require("../../controllers/usuario/usuario.controller.js"); // ajustá el path relativo

router.get("/", getUsuarios);
router.get("/:id", getUsuarioById);
router.post("/", createUsuario);
router.put("/:id", updateUsuario);
router.patch("/:id/password", updateUsuarioPassword);
router.delete("/:id", deleteUsuario);

module.exports = router;
