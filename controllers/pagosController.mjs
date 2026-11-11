// controllers/pagosController.mjs
import { DateTime } from 'luxon';
import config from '../config/env.mjs';
import Horario from '../models/horarioSchema.mjs';
import Misa from '../models/misaSchema.mjs';
import Pago from '../models/pagoSchema.mjs';
import { estadoDesdeEpayco, verificarTransaccion } from '../services/epayco.mjs';
import { generarOrderNumber } from '../utils/counters.mjs';
import { asyncHandler, emailValido, HttpError, requerirCampos, texto, validarObjectId } from '../utils/http.mjs';

const HORA_MS = 60 * 60 * 1000;

const CAMPOS_COMPRADOR = [
  'usuarioId',
  'nombreComprador',
  'celular',
  'direccionResidencia',
  'tipoIdentificacion',
  'numeroDocumento',
  'nombreDestinatario',
  'intencionMisa',
  'metodoPago',
];

/**
 * POST /api/pagos/init
 * Valida el turno, fija el monto según el precio de la misa y crea el pago "pendiente".
 * Respuesta: { orderNumber, monto } → el frontend debe cobrar exactamente ese monto en ePayco.
 */
export const initPayment = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  requerirCampos(body, ['horarioId', 'email', ...CAMPOS_COMPRADOR]);
  validarObjectId(body.horarioId, 'horarioId');

  const email = String(body.email).trim().toLowerCase();
  if (!emailValido(email)) throw new HttpError(400, 'El email no es válido');

  const horario = await Horario.findById(body.horarioId).select('misaId fecha estado').lean();
  if (!horario) throw new HttpError(404, 'Horario no encontrado');
  if (horario.estado !== 'libre') throw new HttpError(409, 'Este horario ya no está disponible. Por favor elige otro.');

  const misa = await Misa.findById(horario.misaId).select('precio tiempoMinCompra').lean();
  if (!misa) throw new HttpError(404, 'Misa no encontrada');

  if (horario.fecha.getTime() < Date.now() + (misa.tiempoMinCompra || 0) * HORA_MS) {
    throw new HttpError(409, `Este horario debe reservarse con al menos ${misa.tiempoMinCompra} horas de anticipación`);
  }

  if (body.monto !== undefined && Number(body.monto) !== misa.precio) {
    console.warn(`initPayment: el frontend envió monto ${body.monto} pero la misa cuesta ${misa.precio}. Se usa el precio de la misa.`);
  }

  const datosComprador = Object.fromEntries(
    CAMPOS_COMPRADOR.map((campo) => [campo, texto(body[campo], campo === 'intencionMisa' ? 1000 : 300)])
  );

  const orderNumber = await generarOrderNumber('pago');

  await Pago.create({
    ...datosComprador,
    email,
    orderNumber,
    horarioId: horario._id,
    monto: misa.precio,
    servicioId: texto(body.servicioId, 100) || String(horario.misaId),
    estadoPago: 'pendiente',
  });

  return res.json({ orderNumber, monto: misa.precio });
});

// Reserva el turno solo si sigue libre (operación atómica: evita dobles reservas)
const reservarHorarioDePago = async (pago) => {
  const reservado = await Horario.findOneAndUpdate(
    { _id: pago.horarioId, estado: 'libre' },
    {
      $set: { estado: 'reservado' },
      $push: {
        reservas: {
          usuarioId: pago.usuarioId,
          nombreComprador: pago.nombreComprador,
          email: pago.email,
          celular: pago.celular,
          tipoIdentificacion: pago.tipoIdentificacion,
          numeroDocumento: pago.numeroDocumento,
          nombreDestinatario: pago.nombreDestinatario,
          intencionMisa: pago.intencionMisa,
          direccionResidencia: pago.direccionResidencia,
          servicioId: pago.servicioId,
          orderNumber: pago.orderNumber,
          pago: { metodo: pago.metodoPago, monto: pago.monto, estado: 'pagado' },
        },
      },
    },
    { new: true }
  );

  if (reservado) return true;

  // Si ePayco reenvía la confirmación, el turno ya está reservado por este mismo pago
  return Boolean(await Horario.exists({ _id: pago.horarioId, 'reservas.orderNumber': pago.orderNumber }));
};

const liberarHorarioDePago = (pago) =>
  Horario.updateOne(
    { _id: pago.horarioId, 'reservas.orderNumber': pago.orderNumber },
    { $set: { estado: 'libre' }, $pull: { reservas: { orderNumber: pago.orderNumber } } }
  );

/**
 * POST /api/pagos/webhook  (URL de confirmación de ePayco)
 * Verifica la transacción con ePayco antes de reservar.
 */
export const confirmationWebhook = asyncHandler(async (req, res) => {
  const payload = { ...req.query, ...req.body };
  const invoice = String(payload.x_id_invoice || payload.x_id_factura || '');

  if (!invoice) return res.status(400).send('Falta x_id_invoice');

  const pago = await Pago.findOne({ orderNumber: invoice });
  if (!pago) {
    console.warn(`Webhook: no existe un pago con orden ${invoice}`);
    return res.status(404).send('Pago no encontrado');
  }

  const verificacion = await verificarTransaccion(payload);
  if (!verificacion.ok) {
    console.warn(`Webhook rechazado (orden ${invoice}): ${verificacion.motivo}`);
    return res.status(400).send('Transacción no verificada');
  }

  const datos = verificacion.datos;
  const invoiceVerificado = datos.x_id_invoice ?? datos.x_id_factura;
  if (invoiceVerificado !== undefined && String(invoiceVerificado) !== invoice) {
    console.warn(`Webhook rechazado (orden ${invoice}): la factura verificada no coincide`);
    return res.status(400).send('Factura no coincide');
  }

  const montoPagado = Number(datos.x_amount);
  if (!Number.isFinite(montoPagado) || Math.abs(montoPagado - pago.monto) > 1) {
    console.warn(`Webhook rechazado (orden ${invoice}): monto pagado ${datos.x_amount}, esperado ${pago.monto}`);
    pago.respuestaEpayco = `Monto no coincide (${datos.x_amount})`;
    await pago.save();
    return res.status(400).send('Monto no coincide');
  }

  pago.refPayco = datos.x_ref_payco ?? pago.refPayco;
  pago.transaccionId = datos.x_transaction_id ?? pago.transaccionId;
  pago.respuestaEpayco = datos.x_response ?? pago.respuestaEpayco;

  const estado = estadoDesdeEpayco(datos);

  if (estado === 'confirmado') {
    if (pago.estadoPago === 'pendiente' || pago.estadoPago === 'rechazado') {
      const reservado = await reservarHorarioDePago(pago);
      if (reservado) {
        pago.estadoPago = 'confirmado';
        pago.confirmadoEn = new Date();
      } else {
        pago.estadoPago = 'conflicto';
        console.error(`⚠️  Orden ${invoice}: pago aprobado pero el horario ya estaba ocupado. Requiere reembolso o reasignación.`);
      }
    }
  } else if (estado === 'reversado') {
    if (pago.estadoPago === 'confirmado') await liberarHorarioDePago(pago);
    pago.estadoPago = 'rechazado';
  } else if (estado === 'rechazado' && pago.estadoPago === 'pendiente') {
    pago.estadoPago = 'rechazado';
  }

  await pago.save();
  return res.status(200).send('OK');
});

// Fecha y hora del turno en hora de Colombia (antes salía en UTC desde Heroku)
const formatearTurno = (fecha) => {
  const dt = DateTime.fromJSDate(fecha).setZone(config.zonaHoraria);
  return { fechaHuman: dt.toFormat('yyyy-MM-dd'), horaHuman: dt.toFormat('HH:mm') };
};

// GET /api/pagos/receipt/:orderNumber
export const getReceipt = asyncHandler(async (req, res) => {
  const orderNumber = String(req.params.orderNumber);
  const pago = await Pago.findOne({ orderNumber }).lean();
  if (!pago) return res.status(404).json({ message: 'Pago no encontrado' });

  const horario = await Horario.findById(pago.horarioId).select('fecha misaId').lean();
  if (!horario) return res.status(404).json({ message: 'Horario no encontrado' });

  return res.json({
    orderNumber,
    ...formatearTurno(horario.fecha),
    nombreComprador: pago.nombreComprador,
    email: pago.email,
    celular: pago.celular,
    numeroDocumento: pago.numeroDocumento,
    nombreDestinatario: pago.nombreDestinatario,
    intencionMisa: pago.intencionMisa,
    metodoPago: pago.metodoPago,
    monto: pago.monto,
    direccionResidencia: pago.direccionResidencia,
    servicioId: pago.servicioId,
    estadoPago: pago.estadoPago,
  });
});

// GET /api/pagos/response/:orderNumber
export const getPaymentResponse = asyncHandler(async (req, res) => {
  const orderNumber = String(req.params.orderNumber);
  const pago = await Pago.findOne({ orderNumber }).lean();
  if (!pago) return res.status(404).json({ message: 'Pago no encontrado' });

  const horario = await Horario.findById(pago.horarioId).select('fecha misaId').lean();
  if (!horario) return res.status(404).json({ message: 'Horario no encontrado' });

  return res.json({
    orderNumber: pago.orderNumber,
    usuarioId: pago.usuarioId,
    nombreComprador: pago.nombreComprador,
    email: pago.email,
    celular: pago.celular,
    direccionResidencia: pago.direccionResidencia,
    tipoIdentificacion: pago.tipoIdentificacion,
    numeroDocumento: pago.numeroDocumento,
    nombreDestinatario: pago.nombreDestinatario,
    intencionMisa: pago.intencionMisa,
    metodoPago: pago.metodoPago,
    monto: pago.monto,
    fecha: horario.fecha,
    misaId: horario.misaId,
    estadoPago: pago.estadoPago,
  });
});
