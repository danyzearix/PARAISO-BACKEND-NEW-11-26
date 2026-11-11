// index.mjs
import config from './config/env.mjs'; // Primero: carga y valida las variables de entorno
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import cron from 'node-cron';

import connectDB from './config/mongoConfig.mjs';
import { manejadorErrores, noEncontrado } from './middleware/errorHandler.mjs';
import { limiteGeneral } from './middleware/rateLimits.mjs';
import horarioRoutes from './routes/horarioRoutes.mjs';
import misaRoutes from './routes/misaRoutes.mjs';
import obituariosRoutes from './routes/obituariosRoutes.mjs';
import pagosRoutes from './routes/pagosRoutes.mjs';
import reservasRoutes from './routes/reservasRoutes.mjs';
import uploadRoutes from './routes/uploadRoutes.mjs';
import usuariosRoutes from './routes/usuariosRoutes.mjs';
import { generarDisponibilidad } from './services/disponibilidad.mjs';

const app = express();

app.set('trust proxy', 1); // Heroku está detrás de un proxy: necesario para el límite por IP
app.disable('x-powered-by');

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(
  cors({
    origin: (origin, callback) => {
      // Sin origin: Postman, servidor a servidor o el webhook de ePayco
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    exposedHeaders: ['auth-token'],
  })
);
app.use(limiteGeneral);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' })); // Formularios de ePayco

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 });
});

app.use('/api/obituarios', obituariosRoutes);
app.use('/api', uploadRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/misas', misaRoutes);
app.use('/api/horarios', horarioRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/reservas', reservasRoutes);

app.use(noEncontrado);
app.use(manejadorErrores);

const actualizarTurnos = async () => {
  try {
    const { misas, creados } = await generarDisponibilidad();
    console.log(`Turnos actualizados: ${creados} nuevos en ${misas} misa(s).`);
  } catch (error) {
    console.error('Error generando turnos:', error);
  }
};

async function iniciar() {
  try {
    await connectDB();
  } catch (error) {
    console.error('Error al conectar a MongoDB Atlas:', error.message);
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`Servidor ejecutándose en el puerto ${config.port}`);
  });

  // Turnos de misas: al arrancar y todos los días a las 00:05 (hora Colombia)
  actualizarTurnos();
  cron.schedule('5 0 * * *', actualizarTurnos, { timezone: config.zonaHoraria });

  // Heroku envía SIGTERM al reiniciar: cerramos limpio
  const cerrar = async (senal) => {
    console.log(`${senal} recibido. Cerrando servidor...`);
    server.close();
    await mongoose.connection.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => cerrar('SIGTERM'));
  process.on('SIGINT', () => cerrar('SIGINT'));
}

iniciar();
