// models/obituariosSchema.mjs
import mongoose from 'mongoose';

const obituariosSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, maxlength: 200 },
    velacion: { type: String, trim: true, maxlength: 300, default: '' },
    exequias: { type: String, trim: true, maxlength: 300, default: '' },
    hora: { type: String, trim: true, maxlength: 20, default: '' },
    destino_final: { type: String, trim: true, maxlength: 300, default: '' },
    // Día del obituario en hora de Colombia, formato AAAA-MM-DD
    fecha: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  },
  { timestamps: true }
);

obituariosSchema.index({ fecha: -1 });
obituariosSchema.index({ nombre: 1, fecha: 1 });

const Obituarios = mongoose.model('Obituarios', obituariosSchema);

export default Obituarios;
