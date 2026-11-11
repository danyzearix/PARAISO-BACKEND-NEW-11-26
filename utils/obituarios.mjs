// utils/obituarios.mjs
// Normaliza los datos de obituarios que llegan del admin o del Excel.
import * as XLSX from 'xlsx';
import { DateTime } from 'luxon';
import { texto } from './http.mjs';

const pad = (n) => String(n).padStart(2, '0');

const fechaValida = (anio, mes, dia) => {
  const dt = DateTime.fromObject({ year: anio, month: mes, day: dia });
  return dt.isValid ? dt.toISODate() : null;
};

/**
 * Convierte cualquier fecha recibida a "AAAA-MM-DD".
 * Acepta: número de fecha de Excel, "2026-11-10", "2026-11-10T05:00:00.000Z",
 * "10/11/2026", "10-11-2026" o "10.11.26" (formato colombiano día/mes/año).
 */
export function normalizarFecha(valor) {
  if (valor === undefined || valor === null || valor === '') return null;

  if (typeof valor === 'number') {
    const d = XLSX.SSF.parse_date_code(valor);
    return d ? fechaValida(d.y, d.m, d.d) : null;
  }

  const s = String(valor).trim();

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return fechaValida(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    let anio = +m[3];
    if (anio < 100) anio += 2000;
    return fechaValida(anio, +m[2], +m[1]);
  }

  return null;
}

/**
 * Convierte la hora a "HH:MM" (24 horas).
 * Acepta: fracción de día de Excel (0.5 = 12:00), "14:30", "2:30 pm", "2:30 p. m.".
 * Si no la reconoce, guarda el texto tal cual (por ejemplo "Por confirmar").
 */
export function normalizarHora(valor) {
  if (valor === undefined || valor === null || valor === '') return '';

  if (typeof valor === 'number') {
    const minutos = Math.round((valor % 1) * 1440) % 1440;
    return `${pad(Math.floor(minutos / 60))}:${pad(minutos % 60)}`;
  }

  const s = String(valor).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?\.?\s*m?\.?$/i);
  if (m) {
    let h = +m[1];
    const min = +m[2];
    const ampm = m[3]?.toLowerCase();
    if (ampm === 'p' && h < 12) h += 12;
    if (ampm === 'a' && h === 12) h = 0;
    if (h < 24 && min < 60) return `${pad(h)}:${pad(min)}`;
  }

  return texto(s, 20);
}

// "Destino Final" → "destino_final", "Velación" → "velacion"
export function normalizarClaves(fila) {
  return Object.fromEntries(
    Object.entries(fila).map(([clave, valor]) => [
      String(clave)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, '_'),
      valor,
    ])
  );
}

const CAMPOS_TEXTO = { nombre: 200, velacion: 300, exequias: 300, destino_final: 300 };

/**
 * Construye un obituario limpio a partir de datos externos.
 * Con parcial = true solo incluye los campos que vienen (para actualizaciones).
 */
export function construirObituario(datos, { parcial = false } = {}) {
  const resultado = {};

  for (const [campo, max] of Object.entries(CAMPOS_TEXTO)) {
    if (!parcial || datos[campo] !== undefined) resultado[campo] = texto(datos[campo], max) ?? '';
  }

  if (!parcial || datos.hora !== undefined) resultado.hora = normalizarHora(datos.hora);
  if (!parcial || datos.fecha !== undefined) resultado.fecha = normalizarFecha(datos.fecha);

  // Quita "(Q.E.P.D)" del nombre; el sitio lo muestra aparte si lo necesita
  if (resultado.nombre) resultado.nombre = resultado.nombre.replace(/\(?\s*\bQ\.?\s*E\.?\s*P\.?\s*D\b\.?\s*\)?/gi, '').trim();

  return resultado;
}
