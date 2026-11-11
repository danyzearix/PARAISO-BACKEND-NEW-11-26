// config/mongoConfig.mjs
import mongoose from 'mongoose';
import config from './env.mjs';

mongoose.set('strictQuery', true);

const connectDB = async () => {
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });
  console.log('Conexión a MongoDB Atlas establecida correctamente');
};

export default connectDB;
