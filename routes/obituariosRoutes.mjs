// routes/obituariosRoutes.mjs
import express from 'express';
import { verifyToken } from '../middleware/auth.mjs';
import {
  actualizarObituario,
  eliminarObituario,
  guardarObituarios,
  obtenerObituarios,
} from '../controllers/obituariosController.mjs';

const router = express.Router();

router.get('/', obtenerObituarios); // Pública: la usa el sitio web
router.post('/', verifyToken, guardarObituarios);
router.put('/:id', verifyToken, actualizarObituario);
router.delete('/:id', verifyToken, eliminarObituario);

export default router;
