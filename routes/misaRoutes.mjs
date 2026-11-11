// routes/misaRoutes.mjs
import express from 'express';
import { createMisa, getMisas, updateMisa } from '../controllers/misaController.mjs';
import { verifyToken } from '../middleware/auth.mjs';

const router = express.Router();

router.get('/', getMisas); // Pública
router.post('/', verifyToken, createMisa);
router.put('/:id', verifyToken, updateMisa);

export default router;
