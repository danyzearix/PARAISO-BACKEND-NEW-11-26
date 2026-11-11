// config/env.mjs
// Carga las variables de entorno una sola vez y valida las obligatorias.
import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

const lista = (valor) =>
  (valor || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const numero = (valor, porDefecto) => {
  if (valor === undefined || valor === '') return porDefecto;
  const n = Number(valor);
  return Number.isFinite(n) ? n : porDefecto;
};

const config = {
  isProd,
  port: numero(process.env.PORT, 3000),
  mongoUri: process.env.MONGODB_URI || process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpira: process.env.JWT_EXPIRES_IN || '8h',
  zonaHoraria: 'America/Bogota',
  diasDisponibilidad: numero(process.env.DIAS_DISPONIBILIDAD, 30),
  horasMinCancelacion: numero(process.env.CANCEL_MIN_HOURS, 24),
  corsOrigins: [
    ...new Set([
      'https://elparaisoparquecementerio.com',
      'https://www.elparaisoparquecementerio.com',
      'https://admin.elparaisoparquecementerio.com',
      ...lista(process.env.CORS_ORIGIN),
      ...(isProd ? [] : ['http://localhost:5173', 'http://localhost:3000']),
    ]),
  ],
  epayco: {
    custId: process.env.EPAYCO_P_CUST_ID,
    pKey: process.env.EPAYCO_P_KEY,
    omitirVerificacion: process.env.EPAYCO_SKIP_VERIFICATION === 'true',
  },
};

const faltantes = [];
if (!config.mongoUri) faltantes.push('MONGODB_URI');
if (!config.jwtSecret) faltantes.push('JWT_SECRET');

if (faltantes.length) {
  console.error(`❌ Faltan variables de entorno obligatorias: ${faltantes.join(', ')}`);
  console.error('   En local: revisa el archivo .env. En Heroku: Settings → Config Vars.');
  process.exit(1);
}

if (config.jwtSecret.length < 32) {
  console.warn('⚠️  JWT_SECRET es muy corto. Usa una cadena aleatoria de al menos 32 caracteres.');
}

if (config.epayco.omitirVerificacion) {
  console.warn('⚠️  EPAYCO_SKIP_VERIFICATION está activo: los pagos NO se verifican. Úsalo solo en emergencias.');
}

export default config;
