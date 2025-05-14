import { Router } from 'express';
import { EspecialidadController } from '../../controllers/especialidad.cotroller.js';

const router = Router();

router.post('/especialidades', EspecialidadController.create);
router.get('/especialidades', EspecialidadController.getAll);

export default router;