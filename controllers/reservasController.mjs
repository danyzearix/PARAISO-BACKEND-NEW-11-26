// controllers/reservasController.mjs
import Horario from '../models/horarioSchema.mjs';
import { asyncHandler } from '../utils/http.mjs';

// Lee ?from=...&to=... y arma el filtro de fechas (si son válidas)
export const rangoFechas = ({ from, to } = {}) => {
  if (!from || !to) return {};
  const desde = new Date(String(from));
  const hasta = new Date(String(to));
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) return {};
  return { fecha: { $gte: desde, $lte: hasta } };
};

/**
 * Etapas comunes: turnos reservados + datos del pago CONFIRMADO de cada turno.
 * (Antes se tomaba cualquier pago del turno, incluso rechazados, y el método de pago salía vacío.)
 */
export const pipelineReservas = (filtroFechas) => [
  { $match: { estado: 'reservado', ...filtroFechas } },
  { $sort: { fecha: 1 } },
  { $unwind: { path: '$reservas', preserveNullAndEmptyArrays: false } },
  {
    $lookup: {
      from: 'pagos',
      let: { horarioId: '$_id' },
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$horarioId', '$$horarioId'] }, { $eq: ['$estadoPago', 'confirmado'] }] } } },
        { $sort: { createdAt: -1 } },
        { $limit: 1 },
        { $project: { direccionResidencia: 1, servicioId: 1, metodoPago: 1, monto: 1, orderNumber: 1 } },
      ],
      as: 'pago_info',
    },
  },
  { $addFields: { pago_info: { $arrayElemAt: ['$pago_info', 0] } } },
  {
    $addFields: {
      'reservas.direccionResidencia': { $ifNull: ['$pago_info.direccionResidencia', '$reservas.direccionResidencia'] },
      'reservas.servicioId': { $ifNull: ['$pago_info.servicioId', '$reservas.servicioId'] },
      'reservas.orderNumber': { $ifNull: ['$pago_info.orderNumber', '$reservas.orderNumber'] },
      'reservas.pago': {
        metodo: { $ifNull: ['$pago_info.metodoPago', '$reservas.pago.metodo'] },
        monto: { $ifNull: ['$pago_info.monto', '$reservas.pago.monto'] },
        estado: '$reservas.pago.estado',
      },
    },
  },
];

/**
 * GET /api/reservas?from=...&to=...  (solo admin)
 * Mismo formato plano que antes: [{ ...datosReserva, fecha, misaId }]
 */
export const listarReservas = asyncHandler(async (req, res) => {
  const reservas = await Horario.aggregate([
    ...pipelineReservas(rangoFechas(req.query)),
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: ['$reservas', { fecha: '$fecha', misaId: { $toString: '$misaId' } }],
        },
      },
    },
  ]);

  res.json(reservas);
});
