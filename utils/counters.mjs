// utils/counters.mjs
import crypto from 'node:crypto';
import Counter from '../models/counterSchema.mjs';

// Sin caracteres confusos (0/O, 1/I). 32 símbolos para una distribución uniforme.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const sufijoAleatorio = (largo = 6) =>
  Array.from(crypto.randomBytes(largo), (b) => ALFABETO[b % ALFABETO.length]).join('');

/**
 * Genera un número de orden único, por ejemplo "000123-K7P2QX".
 * El consecutivo mantiene el orden; el sufijo aleatorio evita que alguien adivine
 * números de orden de otros clientes y consulte sus recibos.
 */
export async function generarOrderNumber(nombre) {
  const counter = await Counter.findByIdAndUpdate(
    nombre,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${String(counter.seq).padStart(6, '0')}-${sufijoAleatorio()}`;
}
