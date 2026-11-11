// routes/horarioRoutes.mjs
import express from 'express';
import {
  cancelarReserva,
  generarHorarios,
  getSlotsReservados,
  obtenerHorarios,
} from '../controllers/horarioController.mjs';
import { verifyToken } from '../middleware/auth.mjs';

const router = express.Router();

// Rutas fijas antes de "/:misaId"
router.get('/reservados', verifyToken, getSlotsReservados);
router.post('/generar', verifyToken, generarHorarios);

router.get('/:misaId', obtenerHorarios); // Pública: turnos libres de una misa
router.put('/:id/cancel', verifyToken, cancelarReserva);

export default router;
