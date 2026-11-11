// controllers/uploadController.mjs
// Carga masiva de obituarios desde Excel. El archivo se procesa en memoria y no se guarda en disco.
import * as XLSX from 'xlsx';
import Obituarios from '../models/obituariosSchema.mjs';
import { asyncHandler, HttpError } from '../utils/http.mjs';
import { construirObituario, normalizarClaves } from '../utils/obituarios.mjs';

const MAX_FILAS = 2000;

const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Adjunta un archivo Excel en el campo "file"');

  let filas;
  try {
    const libro = XLSX.read(req.file.buffer, { type: 'buffer' });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });
  } catch {
    throw new HttpError(400, 'No se pudo leer el archivo. Verifica que sea un Excel válido (.xlsx o .xls).');
  }

  if (!filas.length) throw new HttpError(400, 'El archivo no tiene filas con datos');
  if (filas.length > MAX_FILAS) throw new HttpError(400, `El archivo tiene más de ${MAX_FILAS} filas`);

  const operaciones = [];
  const filasConError = [];

  filas.forEach((fila, i) => {
    const datos = construirObituario(normalizarClaves(fila));
    const numeroFila = i + 2; // +2: la fila 1 del Excel son los encabezados

    if (!datos.nombre || !datos.fecha) {
      filasConError.push(numeroFila);
      return;
    }

    // Si el mismo obituario (nombre + fecha) ya existe, se actualiza en vez de duplicarse
    operaciones.push({
      updateOne: {
        filter: { nombre: datos.nombre, fecha: datos.fecha },
        update: { $set: datos },
        upsert: true,
      },
    });
  });

  let nuevos = 0;
  let actualizados = 0;

  if (operaciones.length) {
    const resultado = await Obituarios.bulkWrite(operaciones, { ordered: false });
    nuevos = resultado.upsertedCount ?? 0;
    actualizados = resultado.modifiedCount ?? 0;
  }

  let mensaje = `Archivo procesado y datos guardados. Nuevos: ${nuevos}. Actualizados: ${actualizados}.`;
  if (filasConError.length) {
    mensaje += ` Filas omitidas por falta de nombre o fecha válida: ${filasConError.join(', ')}.`;
  }

  res.status(200).send(mensaje);
});

export default uploadFile;
