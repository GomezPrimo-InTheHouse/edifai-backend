import { Router } from 'express';
import { EspecialidadController } from '../../controllers/especialidad.cotroller.js';

const router = Router();

router.post('/create', EspecialidadController.create);
router.get('/getAll', EspecialidadController.getAll);

export default router;