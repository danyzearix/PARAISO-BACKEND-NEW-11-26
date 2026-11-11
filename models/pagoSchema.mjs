// models/pagoSchema.mjs
import mongoose from 'mongoose';

export const ESTADOS_PAGO = ['pendiente', 'confirmado', 'rechazado', 'conflicto', 'cancelado'];

const pagoSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    horarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Horario', required: true, index: true },
    usuarioId: { type: String, required: true },
    // El monto lo fija el servidor según el precio de la misa
    monto: { type: Number, required: true },
    nombreComprador: { type: String, required: true },
    email: { type: String, required: true },
    celular: { type: String, required: true },
    tipoIdentificacion: { type: String, required: true },
    numeroDocumento: { type: String, required: true },
    nombreDestinatario: { type: String, required: true },
    intencionMisa: { type: String, required: true },
    metodoPago: { type: String, required: true },
    direccionResidencia: { type: String, required: true },
    servicioId: { type: String },

    // pendiente → confirmado / rechazado. "conflicto": pagado pero el horario ya estaba ocupado (requiere reembolso).
    estadoPago: { type: String, enum: ESTADOS_PAGO, default: 'pendiente', index: true },
    refPayco: { type: String },
    transaccionId: { type: String },
    respuestaEpayco: { type: String },
    confirmadoEn: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Pago', pagoSchema);
