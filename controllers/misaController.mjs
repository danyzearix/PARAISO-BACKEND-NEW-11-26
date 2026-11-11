// controllers/misaController.mjs
import Misa from '../models/misaSchema.mjs';
import { generarDisponibilidad, parsearRango } from '../services/disponibilidad.mjs';
import { asyncHandler, HttpError, texto, validarObjectId } from '../utils/http.mjs';

const DIAS_VALIDOS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

// Normaliza horariosBase: claves sin tildes y rangos con formato "HH:MM-HH:MM"
const validarHorariosBase = (horariosBase) => {
  if (!horariosBase || typeof horariosBase !== 'object' || Array.isArray(horariosBase)) {
    throw new HttpError(400, 'horariosBase debe ser un objeto, por ejemplo { "lunes": ["09:00-16:00"] }');
  }

  const resultado = {};
  for (const [diaOriginal, rangos] of Object.entries(horariosBase)) {
    const dia = diaOriginal.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    if (!DIAS_VALIDOS.includes(dia)) throw new HttpError(400, `Día inválido en horariosBase: "${diaOriginal}"`);
    if (!Array.isArray(rangos)) throw new HttpError(400, `Los horarios de "${diaOriginal}" deben ser una lista`);

    for (const rango of rangos) {
      if (!parsearRango(rango)) throw new HttpError(400, `Rango inválido "${rango}". Usa el formato 09:00-16:00`);
    }
    resultado[dia] = rangos.map((r) => String(r).replace(/\s+/g, ''));
  }
  return resultado;
};

const construirMisa = (body, { parcial = false } = {}) => {
  const datos = {};
  if (!parcial || body.nombre !== undefined) datos.nombre = texto(body.nombre, 150);
  for (const campo of ['capacidad', 'precio', 'duracion', 'tiempoMinCompra']) {
    if (!parcial || body[campo] !== undefined) {
      const valor = Number(body[campo]);
      if (!Number.isFinite(valor)) throw new HttpError(400, `${campo} debe ser un número`);
      datos[campo] = valor;
    }
  }
  if (!parcial || body.horariosBase !== undefined) datos.horariosBase = validarHorariosBase(body.horariosBase);
  return datos;
};

const regenerarTurnos = (misaId) =>
  generarDisponibilidad({ misaId }).catch((error) => console.error('Error generando turnos de la misa:', error));

// GET /api/misas
export const getMisas = asyncHandler(async (req, res) => {
  const misas = await Misa.find().sort({ nombre: 1 }).lean();
  res.status(200).json(misas);
});

// POST /api/misas
export const createMisa = asyncHandler(async (req, res) => {
  const misa = await Misa.create(construirMisa(req.body ?? {}));
  regenerarTurnos(misa._id);
  res.status(201).json(misa);
});

// PUT /api/misas/:id
export const updateMisa = asyncHandler(async (req, res) => {
  validarObjectId(req.params.id);
  const cambios = construirMisa(req.body ?? {}, { parcial: true });

  const misa = await Misa.findByIdAndUpdate(req.params.id, cambios, { new: true, runValidators: true }).lean();
  if (!misa) throw new HttpError(404, 'Misa no encontrada');

  // Agrega turnos para horarios nuevos. Los turnos existentes no se tocan.
  regenerarTurnos(misa._id);
  res.status(200).json(misa);
});
