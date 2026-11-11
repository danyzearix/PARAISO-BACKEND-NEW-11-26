// controllers/horarioController.mjs
import mongoose from 'mongoose';
import config from '../config/env.mjs';
import Horario from '../models/horarioSchema.mjs';
import Misa from '../models/misaSchema.mjs';
import Pago from '../models/pagoSchema.mjs';
import { generarDisponibilidad } from '../services/disponibilidad.mjs';
import { asyncHandler, HttpError, validarObjectId } from '../utils/http.mjs';
import { pipelineReservas, rangoFechas } from './reservasController.mjs';

const HORA_MS = 60 * 60 * 1000;

/**
 * GET /api/horarios/:misaId
 * Turnos libres de una misa, ordenados, y solo los que todavía se pueden comprar
 * (respetando el tiempo mínimo de compra de la misa).
 */
export const obtenerHorarios = asyncHandler(async (req, res) => {
  const { misaId } = req.params;
  if (!mongoose.isValidObjectId(misaId)) return res.json([]);

  const misa = await Misa.findById(misaId).select('tiempoMinCompra').lean();
  if (!misa) return res.json([]);

  const desde = new Date(Date.now() + (misa.tiempoMinCompra || 0) * HORA_MS);

  const horarios = await Horario.find({ misaId, estado: 'libre', fecha: { $gte: desde } })
    .select('-reservas')
    .sort({ fecha: 1 })
    .lean();

  res.json(horarios);
});

/**
 * PUT /api/horarios/:id/cancel  (solo admin)
 * Libera el turno, borra la reserva y marca el pago como cancelado (para gestionar el reembolso).
 */
export const cancelarReserva = asyncHandler(async (req, res) => {
  validarObjectId(req.params.id);
  const horario = await Horario.findById(req.params.id);
  if (!horario) throw new HttpError(404, 'Horario no encontrado');
  if (horario.estado !== 'reservado') throw new HttpError(400, 'Este horario no tiene una reserva activa');

  const horasRestantes = (horario.fecha.getTime() - Date.now()) / HORA_MS;
  if (horasRestantes < 0) throw new HttpError(400, 'No se puede cancelar una misa que ya pasó');

  const minimo = config.horasMinCancelacion;
  if (minimo > 0 && horasRestantes < minimo) {
    throw new HttpError(400, `Solo se puede cancelar con al menos ${minimo} horas de anticipación`);
  }

  const ordenes = horario.reservas.map((r) => r.orderNumber).filter(Boolean);

  horario.estado = 'libre';
  horario.reservas = [];
  await horario.save();

  await Pago.updateMany(
    { horarioId: horario._id, estadoPago: 'confirmado', ...(ordenes.length && { orderNumber: { $in: ordenes } }) },
    { $set: { estadoPago: 'cancelado' } }
  );

  res.json({ message: 'Reserva cancelada correctamente' });
});

/**
 * GET /api/horarios/reservados?from=...&to=...  (solo admin)
 * Mismo formato que antes: [{ _id, reservas: { ...datos, misaId, fecha } }]
 */
export const getSlotsReservados = asyncHandler(async (req, res) => {
  const slots = await Horario.aggregate([
    ...pipelineReservas(rangoFechas(req.query)),
    {
      $addFields: {
        'reservas.misaId': { $toString: '$misaId' },
        'reservas.fecha': '$fecha',
      },
    },
    { $project: { reservas: 1 } },
  ]);

  res.json(slots);
});

// POST /api/horarios/generar  (solo admin) → crea turnos faltantes. Body opcional: { misaId, dias }
export const generarHorarios = asyncHandler(async (req, res) => {
  const { misaId } = req.body ?? {};
  if (misaId) validarObjectId(misaId, 'misaId');

  const dias = Math.min(Math.max(Number(req.body?.dias) || config.diasDisponibilidad, 1), 120);
  const resultado = await generarDisponibilidad({ misaId, dias });
  res.status(201).json({ message: 'Turnos generados', ...resultado });
});
