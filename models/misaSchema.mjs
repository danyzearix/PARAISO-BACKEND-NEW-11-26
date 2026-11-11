// models/misaSchema.mjs
import mongoose from 'mongoose';

const misaSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, maxlength: 150 },
    capacidad: { type: Number, required: true, min: 1 },
    precio: { type: Number, required: true, min: 0 },
    // Duración de cada turno en minutos
    duracion: { type: Number, required: true, min: 5 },
    // Horas mínimas de anticipación para comprar
    tiempoMinCompra: { type: Number, required: true, min: 0 },
    // Ej: { lunes: ["09:00-16:00"], miercoles: ["09:00-12:00", "14:00-16:00"] }
    horariosBase: { type: Object, required: true },
  },
  { timestamps: true }
);

const Misa = mongoose.model('Misa', misaSchema);

export default Misa;
