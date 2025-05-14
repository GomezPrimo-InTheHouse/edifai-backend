import { Router } from "express";
import { ObraController } from "../../controllers/obra.controller.js";

const router = Router();

router.post("/obras", ObraController.create);
router.get("/obras", ObraController.getAll);
router.put("/obras/:id", ObraController.update);
router.delete("/obras/:id", ObraController.remove);

router.get("/obras/ubicacion/:ubicacion", ObraController.getByUbicacion);
router.get("/obras/estado/:estado", ObraController.getByEstado);
router.get("/obras/finalizadas", ObraController.getFinalizadas);
router.get("/obras/retraso", ObraController.getPorRetraso);

export default router;
