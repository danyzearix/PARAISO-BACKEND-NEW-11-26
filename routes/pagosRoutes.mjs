// routes/pagosRoutes.mjs
import express from 'express';
import {
  confirmationWebhook,
  getPaymentResponse,
  getReceipt,
  initPayment,
} from '../controllers/pagosController.mjs';
import { limiteConsultaPagos, limitePagos } from '../middleware/rateLimits.mjs';

const router = express.Router();

router.post('/init', limitePagos, initPayment);

// URL de confirmación de ePayco (llega como formulario por POST; se acepta GET por compatibilidad)
router.post('/webhook', confirmationWebhook);
router.get('/webhook', confirmationWebhook);

router.get('/receipt/:orderNumber', limiteConsultaPagos, getReceipt);
router.get('/response/:orderNumber', limiteConsultaPagos, getPaymentResponse);

export default router;
