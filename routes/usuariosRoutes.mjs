// routes/usuariosRoutes.mjs
import express from 'express';
import { loginUsuarios, registrarUsuarios } from '../controllers/usuariosController.mjs';
import { primerUsuarioOAdmin } from '../middleware/auth.mjs';
import { limiteLogin } from '../middleware/rateLimits.mjs';

const router = express.Router();

// El primer usuario se crea libremente; los siguientes solo con sesión de admin
router.post('/registro', primerUsuarioOAdmin, registrarUsuarios);
router.post('/login', limiteLogin, loginUsuarios);

export default router;
