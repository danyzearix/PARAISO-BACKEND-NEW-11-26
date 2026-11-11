// routes/reservasRoutes.mjs
import express from 'express';
import { listarReservas } from '../controllers/reservasController.mjs';
import { verifyToken } from '../middleware/auth.mjs';

const router = express.Router();

router.get('/', verifyToken, listarReservas);

export default router;
