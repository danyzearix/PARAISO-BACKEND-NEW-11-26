// scripts/seedHorarios.mjs
// Uso: npm run seed:horarios        (genera turnos para los próximos días y termina)
// La API ya lo hace sola al arrancar y cada noche; este script es para ejecutarlo a mano.
import mongoose from 'mongoose';
import connectDB from '../config/mongoConfig.mjs';
import { generarDisponibilidad } from '../services/disponibilidad.mjs';

try {
  await connectDB();
  const { misas, creados } = await generarDisponibilidad();
  if (!misas) console.warn('⚠️  No hay misas configuradas. Créalas primero con POST /api/misas.');
  console.log(`✅ ${creados} turno(s) nuevo(s) en ${misas} misa(s).`);
} catch (error) {
  console.error('Error generando turnos:', error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
