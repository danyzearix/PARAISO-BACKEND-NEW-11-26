// utils/http.mjs
// Utilidades comunes para controladores: errores HTTP, async y validaciones.
import mongoose from 'mongoose';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Express 4 no captura errores de funciones async: este envoltorio los pasa al manejador central.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Convierte a texto, quita etiquetas HTML, recorta espacios y limita la longitud.
export const texto = (valor, max = 500) => {
  if (valor === undefined || valor === null) return undefined;
  return String(valor).replace(/<[^>]*>/g, '').trim().slice(0, max);
};

export const requerirCampos = (obj, campos) => {
  const faltan = campos.filter(
    (c) => obj?.[c] === undefined || obj[c] === null || String(obj[c]).trim() === ''
  );
  if (faltan.length) {
    throw new HttpError(400, `Faltan campos obligatorios: ${faltan.join(', ')}`);
  }
};

export const validarObjectId = (id, nombre = 'ID') => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, `${nombre} inválido`);
};

export const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
