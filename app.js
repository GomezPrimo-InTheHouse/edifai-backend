const express = require('express');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin.includes('localhost') || origin.includes('vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// LOG
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ── Inicializar SSE antes de las rutas ──
const notifController = require('./controllers/notificaciones/notificaciones.controller');
const { setEmitirSSE } = require('./src/helpers/notificar.js'); 
setEmitirSSE(notifController.emitirSSE);

// ── Tanda 1 ──
app.use('/auth',           require('./routes/auth/auth.routes.js'));
app.use('/clientes',       require('./routes/clientes/clientes.routes.js'));
app.use('/estado',         require('./routes/estado/estado.routes.js'));
app.use('/notificaciones', require('./routes/notificaciones/notificaciones.routes.js'));
app.use('/dashboard',      require('./routes/dashboard/dashboard.routes.js'));

// ── Tanda 2 ──
app.use('/usuario',        require('./routes/usuario/usuarios.routes.js'));
app.use('/usuario-rol',    require('./routes/usuario/userRol/userRol.routes.js'));
app.use('/especialidad',   require('./routes/especialidad/especialidad.routes.js'));
app.use('/trabajador',     require('./routes/trabajadores/trabajadores.routes.js'));
app.use('/presentismo',    require('./routes/presentismo/presentismo.routes.js'));

// ── Tanda 3 ──
app.use('/obra',           require('./routes/obra/obra.routes.js'));
app.use('/labor',          require('./routes/labores/labores.routes.js'));
app.use('/materiales',     require('./routes/materiales/materiales.routes.js'));
app.use('/tipoMaterial',   require('./routes/materiales/tipoMaterial.routes.js'));
app.use('/historial',      require('./routes/materiales/historialIncremento.routes.js'));
app.use('/presupuestos',   require('./routes/presupuestos/presupuestos.routes.js'));
app.use('/presupuestoMateriales', require('./routes/presupuestos/presupuestoMateriales.routes.js'));
app.use('/pagos',          require('./routes/pagos/pagos.routes.js'));
app.use('/formasPago',     require('./routes/pagos/formasPago.routes.js'));

// Health check
app.get('/health', (_req, res) => res.json({
  status:    'ok',
  version:   'monolito',
  timestamp: new Date().toISOString(),
}));

app.listen(PORT, () => {
  console.log(`🚀 EdifAI monolito corriendo en puerto ${PORT}`);
});

module.exports = app;