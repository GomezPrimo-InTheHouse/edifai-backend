import {Router} from 'express'
import { UserController } from '../controllers/user.controller.js'
import { verifyToken } from '../middlewares/jwt.middleware.js';

const router = Router();

router.post('/register', UserController.register)
router.post('/login', UserController.login)
router.get('/getAllUsers', UserController.getAllUsers)
router.post('/deleteUser', UserController.deleteUser)
router.get('/findOneByEmail', UserController.findOneByEmail)
router.get('/profile', verifyToken , UserController.profile)


export default router;