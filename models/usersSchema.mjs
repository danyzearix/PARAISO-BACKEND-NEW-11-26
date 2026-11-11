// models/usersSchema.mjs
import mongoose from 'mongoose';

const usuariosSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    direccionResidencia: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

const Usuarios = mongoose.model('Usuarios', usuariosSchema);

export default Usuarios;
