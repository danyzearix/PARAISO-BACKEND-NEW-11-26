// middleware/errorHandler.mjs
import multer from 'multer';
import mongoose from 'mongoose';
import { HttpError } from '../utils/http.mjs';

export const noEncontrado = (req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
};

// eslint-disable-next-line no-unused-vars
export const manejadorErrores = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el tamaño máximo permitido (5 MB)' : err.message;
    return res.status(400).json({ message });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(Object.entries(err.errors).map(([campo, e]) => [campo, e.message]));
    return res.status(400).json({ message: 'Datos inválidos', details });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: `Valor inválido para ${err.path}` });
  }

  if (err?.code === 11000) {
    return res.status(409).json({ message: 'El registro ya existe' });
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'El cuerpo de la petición no es un JSON válido' });
  }

  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'La petición es demasiado grande' });
  }

  console.error('Error no controlado:', err);
  res.status(500).json({ message: 'Error en el servidor' });
};
