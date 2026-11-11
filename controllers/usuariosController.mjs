// controllers/usuariosController.mjs
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/env.mjs';
import Usuarios from '../models/usersSchema.mjs';
import { asyncHandler, emailValido, HttpError, texto } from '../utils/http.mjs';

export const registrarUsuarios = asyncHandler(async (req, res) => {
  const nombre = texto(req.body?.nombre, 100);
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const direccionResidencia = texto(req.body?.direccionResidencia, 300) ?? '';

  if (!nombre || !email || !password) throw new HttpError(400, 'Nombre, email y contraseña son obligatorios');
  if (!emailValido(email)) throw new HttpError(400, 'El email no es válido');
  if (password.length < 8) throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres');

  if (await Usuarios.exists({ email })) {
    return res.status(400).json({ message: 'El usuario ya existe' });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await Usuarios.create({ nombre, email, password: hashedPassword, direccionResidencia });

  res.status(201).json({ message: 'Usuario registrado con éxito' });
});

export const loginUsuarios = asyncHandler(async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  const usuario = email ? await Usuarios.findOne({ email }).lean() : null;
  const valido = Boolean(usuario && password && (await bcrypt.compare(password, usuario.password)));

  if (!valido) return res.status(400).send('Credenciales no válidas');

  const token = jwt.sign({ _id: usuario._id }, config.jwtSecret, { expiresIn: config.jwtExpira });

  // Igual que antes: el token va en el cuerpo (texto) y en el header "auth-token"
  res.header('auth-token', token).send(token);
});
