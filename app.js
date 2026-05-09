// const { spawn } = require('child_process');
// const path = require('path');
// const express = require('express');
// const { createProxyMiddleware } = require('http-proxy-middleware');

// const GATEWAY_PORT = process.env.PORT || 3000;

// const services = [
//   { name: 'ms-auth.js',           port: 7001, prefix: ['/auth'] },
//   { name: 'ms-usuario.js',        port: 7002, prefix: ['/usuario', '/usuario-rol'] },
//   { name: 'ms-trabajadores.js',   port: 7003, prefix: ['/trabajador', '/especialidad', '/presentismo'] },
//   { name: 'ms-obra.js',           port: 7004, prefix: ['/obra', '/dashboard'] },
//   { name: 'ms-labores.js',        port: 7005, prefix: ['/labor'] },
//   { name: 'ms-estado.js',         port: 7006, prefix: ['/estado'] },
//   { name: 'ms-materiales.js',     port: 7007, prefix: ['/materiales', '/tipoMaterial', '/historial', '/presupuestos', '/presupuestoMateriales'] },
//   { name: 'ms-pagos.js',          port: 7008, prefix: ['/pagos', '/formasPago'] },
//   { name: 'ms-notificaciones.js', port: 7009, prefix: ['/notificaciones'] },
//   { name: 'ms-clientes.js',       port: 7010, prefix: ['/clientes'] },
// ];

// // 1. Spawnear microservicios
// services.forEach(service => {
//   const servicePath = path.join(__dirname, 'microservices', service.name);
//   const child = spawn('node', [servicePath], {
//     env: { ...process.env, MS_PORT: service.port },
//     stdio: 'inherit',
//     shell: true,
//   });
//   child.on('close', code => console.log(`✅ ${service.name} cerró con código ${code}`));
//   child.on('error', err => console.error(`❌ Error al iniciar ${service.name}:`, err));
// });

// // 2. Gateway
// const app = express();

// // // CORS
// // const ALLOWED_ORIGINS = [
// //   'https://edifai-eight.vercel.app',
// //   'edifai-git-main-julians-projects-22f74901.vercel.app',
// //   'http://localhost:5173',
// //   'http://localhost:3000',
// // ];

// // app.use((req, res, next) => {
// //   const origin = req.headers.origin;
// //   if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.includes('localhost'))) {
// //     res.setHeader('Access-Control-Allow-Origin', origin);
// //   }
// //   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
// //   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
// //   if (req.method === 'OPTIONS') return res.sendStatus(200);
// //   next();
// // });
// app.use((req, res, next) => {
//   const origin = req.headers.origin;
//   if (
//     origin &&
//     (origin.includes('localhost') || origin.includes('vercel.app'))
//   ) {
//     res.setHeader('Access-Control-Allow-Origin', origin);
//   }
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
//   if (req.method === 'OPTIONS') return res.sendStatus(200);
//   next();
// });

// // LOG — para debuggear, sacar después
// app.use((req, res, next) => {
//   console.log(`GATEWAY → ${req.method} ${req.url}`);
//   next();
// });

// // 3. Proxy
// services.forEach(service => {
//   service.prefix.forEach(prefix => {
//     app.use(prefix, createProxyMiddleware({
//       target: `http://localhost:${service.port}`,
//       changeOrigin: true,
//       pathRewrite: (path) => prefix + path,
//     }));
//   });
// });

// app.get('/health', (_req, res) => res.json({ status: 'ok', gateway: true }));

// app.listen(GATEWAY_PORT, () => {
//   console.log(`🚀 Gateway corriendo en puerto ${GATEWAY_PORT}`);
// });
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


// --- Tanda 3 ---
app.use('/obra',           require('./routes/obra/obra.routes.js'));
app.use('/labor',          require('./routes/labores/labores.routes.js'));
app.use('/materiales',     require('./routes/materiales/materiales.routes.js'));
app.use('/tipoMaterial',   require('./routes/materiales/tipoMaterial.routes.js'));
app.use('/historial',      require('./routes/materiales/historialIncremento.routes.js'));
app.use('/presupuestos',   require('./routes/presupuestos/presupuestos.routes.js'));
app.use('/presupuestoMateriales', require('./routes/presupuestos/presupuestoMateriales.routes.js'));
app.use('/pagos',          require('./routes/pagos/pagos.routes.js'));
app.use('/formasPago',     require('./routes/pagos/formasPago.routes.js'));

// --- Tanda 4 ---
// estadisticas, 


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