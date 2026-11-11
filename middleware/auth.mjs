// middleware/auth.mjs
import jwt from 'jsonwebtoken';
import config from '../config/env.mjs';
import Usuarios from '../models/usersSchema.mjs';

// Acepta el header "auth-token" (el que ya usa el admin) o "Authorization: Bearer <token>".
const extraerToken = (req) => {
  const token = req.header('auth-token');
  if (token) return token;
  const auth = req.header('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
};

export const verifyToken = (req, res, next) => {
  const token = extraerToken(req);
  if (!token) return res.status(401).json({ message: 'Acceso denegado' });

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido o vencido' });
  }
};

// Permite crear el primer usuario sin token. Cuando ya hay usuarios, solo un admin logueado puede crear otros.
export const primerUsuarioOAdmin = async (req, res, next) => {
  try {
    const hayUsuarios = await Usuarios.exists({});
    if (!hayUsuarios) return next();
    return verifyToken(req, res, next);
  } catch (error) {
    next(error);
  }
};
