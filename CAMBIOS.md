# Paraíso Backend v2: cambios y despliegue

## Qué cambió

### Seguridad
- **Credenciales fuera del código.** La URI de Mongo y el secreto del JWT se leen de variables de entorno. Si falta alguna, la API no arranca y lo indica en el log.
- **Rutas de administración protegidas con login.** Exigen el header `auth-token`: crear, editar y eliminar obituarios, subir el Excel, crear y editar misas, generar turnos, ver reservas y cancelar reservas.
- **Registro cerrado.** `/api/usuarios/registro` solo funciona sin login cuando la base no tiene usuarios. Después, solo un admin con sesión puede crear otros usuarios.
- **Límite de intentos.** El login acepta 10 intentos fallidos cada 15 minutos por IP. También hay límites para iniciar pagos y consultar recibos.
- **Pagos verificados con ePayco.** El webhook valida la firma (si están las llaves) o consulta la transacción directamente a ePayco. También revisa que la factura y el monto coincidan.
- **El monto lo decide el servidor**, según el precio de la misa. Antes lo enviaba el navegador, y cualquiera podía cambiarlo.
- **Números de orden no adivinables**, por ejemplo `000123-K7P2QX`, para que nadie pueda recorrer recibos ajenos.
- **Limpieza de datos.** Se quitan etiquetas HTML de los textos que llegan (protege el sitio contra código malicioso en obituarios).
- **Los Excel ya no se guardan en el servidor** ni quedan publicados. Se procesan en memoria.
- **Encabezados de seguridad** (helmet) y CORS con lista de dominios permitidos.
- **No se imprimen datos personales ni contraseñas en los logs.**

### Flujo de datos (bugs corregidos)
- **Estado del pago:** `estadoPago` ahora existe en el modelo (antes se perdía). Los estados son `pendiente`, `confirmado`, `rechazado`, `conflicto` y `cancelado`.
- **Doble reserva imposible.** El turno se reserva en una sola operación atómica, solo si sigue libre. Si dos personas pagan el mismo turno, la segunda queda como `conflicto` para reembolso.
- **Confirmaciones repetidas de ePayco** ya no duplican reservas.
- **Turnos en hora de Colombia.** El generador usaba la hora del servidor (UTC en Heroku): una misa de 9:00 quedaba a las 4:00 a. m.
- **Turnos automáticos.** Se generan al arrancar la API y cada noche a las 00:05. Ya no hace falta correr el script a mano.
- **Turnos disponibles:** solo se muestran los que respetan el tiempo mínimo de compra de cada misa, ordenados por fecha.
- **Recibos con hora de Colombia** (antes salía en UTC).
- **Listado de reservas:** el método de pago ya no sale vacío, y solo se toma el pago confirmado (antes podía tomar uno rechazado).
- **Cancelación:** ahora se puede cancelar con **al menos** 24 horas de anticipación (antes la regla estaba invertida). Se configura con `CANCEL_MIN_HOURS` (0 = sin límite). El pago queda como `cancelado` para gestionar el reembolso.
- **Obituarios:**
  - Nuevas rutas para editar (`PUT /api/obituarios/:id`) y eliminar (`DELETE /api/obituarios/:id`).
  - La fecha se guarda siempre como `AAAA-MM-DD`. El Excel acepta fechas de Excel, `2026-11-10` y `10/11/2026`.
  - La hora acepta `14:30`, `2:30 pm` o el formato de hora de Excel.
  - Subir el mismo Excel dos veces **actualiza** en lugar de duplicar.
  - El "(Q.E.P.D)" se quita del nombre al guardar.
- **Misas:** nueva ruta para editarlas (`PUT /api/misas/:id`), con validación de horarios base.

### Rendimiento
- Índices en Mongo para turnos, pagos y obituarios.
- Consultas de solo lectura más livianas (`lean`), compresión de respuestas y generación de turnos en lote.
- `GET /api/obituarios?fecha=AAAA-MM-DD` devuelve solo los del día.
- Se quitaron 8 dependencias que no se usaban.

### Node 24
- `engines.node: 24.x`, Mongoose 8, Multer 2, xlsx 0.20.3 (versión sin vulnerabilidades conocidas), bcryptjs en lugar de bcrypt.
- `npm run dev` usa `node --watch` (ya no hace falta nodemon).

---

## ⚠️ Cambios que afectan al frontend y al admin

1. **El admin debe enviar el token** en las peticiones protegidas. Agrega esto donde se configure axios (ajusta el nombre con el que se guarda el token):

   ```javascript
   axios.interceptors.request.use((config) => {
     const token = localStorage.getItem('token');
     if (token) config.headers['auth-token'] = token;
     return config;
   });

   axios.interceptors.response.use(
     (res) => res,
     (error) => {
       if (error.response?.status === 401) {
         localStorage.removeItem('token');
         window.location.href = '/login';
       }
       return Promise.reject(error);
     }
   );
   ```

   Después del despliegue, todos deben **volver a iniciar sesión**, porque cambió el secreto del token.

2. **Pagos:** `POST /api/pagos/init` ahora responde `{ orderNumber, monto }`. El checkout de ePayco debe cobrar **ese monto**. Si se cobra otro valor, el pago no se confirma automáticamente.

3. **Respuesta del login:** no cambia. Sigue devolviendo el token como texto y en el header `auth-token`.

4. **Sitio de WordPress (opcional):** para cargar más rápido, el script de obituarios puede pedir solo los del día:

   ```javascript
   const response = await fetch(`${API_URL}?fecha=${fechaHoyBogota()}`);
   ```

---

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `MONGODB_URI` | Sí | URI de Atlas, con el nombre de la base antes del `?` |
| `JWT_SECRET` | Sí | Cadena aleatoria de 32 caracteres o más |
| `JWT_EXPIRES_IN` | No | Duración de la sesión (por defecto `8h`) |
| `CORS_ORIGIN` | No | Dominios extra, separados por coma. Los del sitio, www y admin ya están incluidos |
| `DIAS_DISPONIBILIDAD` | No | Días de turnos a generar (por defecto 30) |
| `CANCEL_MIN_HOURS` | No | Horas mínimas para cancelar (por defecto 24) |
| `EPAYCO_P_CUST_ID` / `EPAYCO_P_KEY` | Recomendadas | Llaves del panel de ePayco para validar la firma |
| `EPAYCO_SKIP_VERIFICATION` | No | Solo para emergencias: `true` desactiva la verificación |

Para generar un `JWT_SECRET` en PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
```

---

## Despliegue (PowerShell)

```powershell
# 1. Rama nueva para no tocar main hasta probar
git checkout -b mejoras-v2

# 2. Borrar lo que ya no se usa
Remove-Item -Recurse -Force .\config\epaycoConfig.mjs, .\uploads, .\public, .\node_modules, .\package-lock.json -ErrorAction SilentlyContinue

# 3. Descomprimir la versión nueva encima (ajusta la ruta del zip)
Expand-Archive -Path "$HOME\Downloads\paraiso-backend-v2.zip" -DestinationPath . -Force

# 4. Sacar el .ENV del repositorio y crear el .env local
git rm --cached .ENV
Copy-Item .env.example .env
notepad .env   # completa MONGODB_URI y JWT_SECRET

# 5. Instalar dependencias (en local sirve Node 22 o superior; Heroku usará Node 24)
node --version
npm install

# 6. Probar en local
npm run dev
```

Si todo funciona en local:

```powershell
git add -A
git commit -m "v2: seguridad, flujo de pagos, rendimiento y Node 24"
git push -u origin mejoras-v2
```

En Heroku:
1. **Settings → Config Vars:** agrega `MONGODB_URI` y cambia `JWT_SECRET` por uno fuerte.
2. Cambia el stack: `heroku stack:set heroku-24 -a paraiso-node-api`.
3. **Deploy:** despliega la rama `mejoras-v2`. Cuando todo esté probado, haz merge a `main`.
4. Revisa el log: debe aparecer `Conexión a MongoDB Atlas establecida correctamente` y `Turnos actualizados`.
5. Prueba `https://paraiso-node-api-0c5186e80e32.herokuapp.com/api/health`. Debe responder `{"ok":true,"db":true}`.

Después, cambia la clave del usuario de Mongo en Atlas (la anterior quedó en el historial de Git) y actualízala en `.env` y en Heroku.

---

## Comandos útiles

```powershell
# Crear un admin o cambiarle la contraseña
npm run admin -- admin@elparaisoparquecementerio.com "ClaveSegura123" "Administrador"

# En Heroku
heroku run "npm run admin -- admin@elparaisoparquecementerio.com ClaveSegura123" -a paraiso-node-api

# Generar turnos a mano (la API ya lo hace sola)
npm run seed:horarios
```

---

## Pendiente de confirmar

- **Verificación de ePayco sin llaves:** si no se configuran `EPAYCO_P_CUST_ID` y `EPAYCO_P_KEY`, la API consulta la transacción en la API de validación de ePayco. Haz un pago de prueba y revisa el log. Si aparece `Webhook rechazado`, consigue las llaves del panel de ePayco.
- **Regla de cancelación:** si la intención original era otra, se ajusta con `CANCEL_MIN_HOURS`.
- **Pagos en `conflicto`** (cobrados sin turno): por ahora solo quedan en la base y en el log. Conviene revisarlos periódicamente en Atlas.
