// models/horarioSchema.mjs
import mongoose from 'mongoose';

const reservaSchema = new mongoose.Schema({
  usuarioId: { type: String, required: true },
  nombreComprador: { type: String, required: true },
  email: { type: String, required: true },
  celular: { type: String, required: true },
  tipoIdentificacion: { type: String, required: true },
  numeroDocumento: { type: String, required: true },
  nombreDestinatario: { type: String, required: true },
  intencionMisa: { type: String, required: true },
  fechaReserva: { type: Date, default: Date.now },
  pago: {
    metodo: { type: String },
    monto: { type: Number, required: true },
    estado: { type: String, enum: ['pendiente', 'pagado'], default: 'pendiente' },
  },
  direccionResidencia: { type: String, required: true },
  servicioId: { type: String },
  // Enlace con el pago que generó la reserva
  orderNumber: { type: String },
});

const horarioSchema = new mongoose.Schema({
  misaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Misa', required: true },
  fecha: { type: Date, required: true },
  estado: { type: String, enum: ['libre', 'reservado', 'bloqueado'], default: 'libre' },
  reservas: [reservaSchema],
});

// Un solo turno por misa y hora; acelera la búsqueda de horarios libres
horarioSchema.index({ misaId: 1, fecha: 1 }, { unique: true });
horarioSchema.index({ estado: 1, fecha: 1 });
horarioSchema.index({ 'reservas.orderNumber': 1 }, { sparse: true });

export default mongoose.model('Horario', horarioSchema);
