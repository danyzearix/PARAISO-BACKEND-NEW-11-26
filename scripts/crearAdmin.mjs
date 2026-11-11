// scripts/crearAdmin.mjs
// Crea un usuario admin o le cambia la contraseña si ya existe.
// Uso: npm run admin -- correo@dominio.com "ClaveSegura123" "Nombre"
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import connectDB from '../config/mongoConfig.mjs';
import Usuarios from '../models/usersSchema.mjs';

const [email, password, nombre = 'Administrador'] = process.argv.slice(2);

if (!email || !password) {
  console.error('Uso: npm run admin -- correo@dominio.com "ClaveSegura123" "Nombre"');
  process.exit(1);
}
if (password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres.');
  process.exit(1);
}

try {
  await connectDB();
  const hash = await bcrypt.hash(password, 12);
  const correo = email.trim().toLowerCase();
  const existente = await Usuarios.findOne({ email: correo });

  if (existente) {
    existente.password = hash;
    await existente.save();
    console.log(`✅ Contraseña actualizada para ${correo}`);
  } else {
    await Usuarios.create({ nombre, email: correo, password: hash });
    console.log(`✅ Usuario creado: ${correo}`);
  }
} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
