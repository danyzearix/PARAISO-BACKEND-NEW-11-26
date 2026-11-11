// services/disponibilidad.mjs
// Genera los turnos (horarios) de cada misa según sus horarios base, en hora de Colombia.
import { DateTime } from 'luxon';
import config from '../config/env.mjs';
import Misa from '../models/misaSchema.mjs';
import Horario from '../models/horarioSchema.mjs';

// Índice = weekday de Luxon (1 = lunes ... 7 = domingo)
const DIAS = [null, 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIAS_CON_TILDE = { miercoles: 'miércoles', sabado: 'sábado' };

const RANGO = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;

export const parsearRango = (rango) => {
  const m = String(rango).trim().match(RANGO);
  if (!m) return null;
  const inicio = +m[1] * 60 + +m[2];
  const fin = +m[3] * 60 + +m[4];
  return inicio < fin && fin <= 24 * 60 ? { inicio, fin } : null;
};

const rangosDelDia = (horariosBase = {}, nombreDia) =>
  horariosBase[nombreDia] ?? horariosBase[DIAS_CON_TILDE[nombreDia]] ?? [];

/**
 * Crea los turnos que falten para los próximos días. Nunca modifica turnos existentes,
 * así que se puede ejecutar las veces que sea sin duplicar ni borrar reservas.
 */
export async function generarDisponibilidad({ misaId, dias = config.diasDisponibilidad } = {}) {
  const misas = await Misa.find(misaId ? { _id: misaId } : {}).lean();
  const ahora = DateTime.now().setZone(config.zonaHoraria);
  const hoy = ahora.startOf('day');
  let creados = 0;

  for (const misa of misas) {
    const duracion = Number(misa.duracion);
    if (!duracion || duracion < 5) {
      console.warn(`Misa "${misa.nombre}" tiene una duración inválida; se omite.`);
      continue;
    }

    const operaciones = [];

    for (let i = 0; i < dias; i++) {
      const dia = hoy.plus({ days: i });
      const rangos = rangosDelDia(misa.horariosBase, DIAS[dia.weekday]);

      for (const texto of rangos) {
        const rango = parsearRango(texto);
        if (!rango) {
          console.warn(`Misa "${misa.nombre}": rango inválido "${texto}" (usa el formato 09:00-16:00).`);
          continue;
        }

        for (let minuto = rango.inicio; minuto < rango.fin; minuto += duracion) {
          const turno = dia.plus({ minutes: minuto });
          if (turno <= ahora) continue;
          const fecha = turno.toJSDate();

          operaciones.push({
            updateOne: {
              filter: { misaId: misa._id, fecha },
              update: { $setOnInsert: { misaId: misa._id, fecha, estado: 'libre', reservas: [] } },
              upsert: true,
            },
          });
        }
      }
    }

    if (operaciones.length) {
      const resultado = await Horario.bulkWrite(operaciones, { ordered: false });
      creados += resultado.upsertedCount ?? 0;
    }
  }

  return { misas: misas.length, creados };
}
