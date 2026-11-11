// controllers/obituariosController.mjs
import Obituarios from '../models/obituariosSchema.mjs';
import { asyncHandler, HttpError, validarObjectId } from '../utils/http.mjs';
import { construirObituario, normalizarFecha } from '../utils/obituarios.mjs';

/**
 * GET /api/obituarios            → todos, del más reciente al más antiguo
 * GET /api/obituarios?fecha=AAAA-MM-DD → solo los de ese día (más liviano para el sitio)
 */
export const obtenerObituarios = asyncHandler(async (req, res) => {
  const filtro = {};

  if (req.query.fecha) {
    const fecha = normalizarFecha(String(req.query.fecha));
    if (!fecha) throw new HttpError(400, 'Fecha inválida. Usa el formato AAAA-MM-DD');
    filtro.fecha = fecha;
  }

  const obituarios = await Obituarios.find(filtro).sort({ fecha: -1, hora: 1 }).lean();
  res.status(200).json(obituarios);
});

// POST /api/obituarios
export const guardarObituarios = asyncHandler(async (req, res) => {
  const datos = construirObituario(req.body ?? {});

  if (!datos.nombre) throw new HttpError(400, 'El nombre es obligatorio');
  if (!datos.fecha) throw new HttpError(400, 'La fecha es obligatoria y debe ser válida (AAAA-MM-DD o DD/MM/AAAA)');

  const nuevoObituario = await Obituarios.create(datos);
  res.status(201).json(nuevoObituario);
});

// PUT /api/obituarios/:id
export const actualizarObituario = asyncHandler(async (req, res) => {
  validarObjectId(req.params.id);
  const cambios = construirObituario(req.body ?? {}, { parcial: true });

  if ('nombre' in cambios && !cambios.nombre) throw new HttpError(400, 'El nombre no puede quedar vacío');
  if ('fecha' in cambios && !cambios.fecha) throw new HttpError(400, 'La fecha no es válida');
  if (!Object.keys(cambios).length) throw new HttpError(400, 'No se enviaron campos para actualizar');

  const obituario = await Obituarios.findByIdAndUpdate(req.params.id, cambios, {
    new: true,
    runValidators: true,
  }).lean();

  if (!obituario) throw new HttpError(404, 'Obituario no encontrado');
  res.status(200).json(obituario);
});

// DELETE /api/obituarios/:id
export const eliminarObituario = asyncHandler(async (req, res) => {
  validarObjectId(req.params.id);
  const obituario = await Obituarios.findByIdAndDelete(req.params.id).lean();

  if (!obituario) throw new HttpError(404, 'Obituario no encontrado');
  res.status(200).json({ message: 'Obituario eliminado' });
});
