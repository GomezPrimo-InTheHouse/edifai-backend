import { Router } from "express";
import { TrabajadorController } from "../../controllers/trabajador.controller.js";

const router = Router();

router.post("/trabajadores", TrabajadorController.create);
router.get("/trabajadores", TrabajadorController.getAll);
router.put("/trabajadores/:id", TrabajadorController.update);
router.get("/trabajadores/obra/:obra_id", TrabajadorController.getByObraId);
router.get("/trabajadores/dni/:dni", TrabajadorController.getByDNI);
router.get("/trabajadores/buscar", TrabajadorController.getByNombreApellido); // usar query: ?nombre=Juan&apellido=Perez
router.get("/trabajadores/jefe/:jefe_id", TrabajadorController.getByJefeId);


export default router;
