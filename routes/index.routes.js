import { Router } from "express";
import obrasRoutes from "./obra/obra.route.js";
import trabajadoresRoutes from "./trabajador/trabajador.route.js";
import usuariosRoutes from "./usuario/usuario.route.js";
import especialidadesRoutes from "./especialidad/especialidad.route.js";


const router = Router();

router.use("/obras", obrasRoutes);
router.use("/trabajadores", trabajadoresRoutes);
router.use("/usuarios", usuariosRoutes);
router.use("/especialidades", especialidadesRoutes);

export default router;
