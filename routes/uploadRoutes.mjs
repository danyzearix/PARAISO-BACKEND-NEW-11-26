// routes/uploadRoutes.mjs
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import uploadFile from '../controllers/uploadController.mjs';
import { verifyToken } from '../middleware/auth.mjs';
import { HttpError } from '../utils/http.mjs';

const router = express.Router();

const EXTENSIONES = ['.xlsx', '.xls'];
const TIPOS = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
];

// En memoria: el Excel se procesa y se descarta (no quedan archivos en el servidor)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (EXTENSIONES.includes(extension) && TIPOS.includes(file.mimetype)) return cb(null, true);
    cb(new HttpError(400, 'Tipo de archivo no soportado. Sube un archivo .xlsx o .xls'));
  },
});

router.post('/upload', verifyToken, upload.single('file'), uploadFile);

export default router;
