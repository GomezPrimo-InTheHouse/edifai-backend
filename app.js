const { spawn } = require('child_process');
const path = require('path');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const GATEWAY_PORT = process.env.PORT || 3000;

const services = [
  { name: 'ms-auth.js',           port: 7001, prefix: ['/auth'] },
  { name: 'ms-usuario.js',        port: 7002, prefix: ['/usuario', '/usuario-rol'] },
  { name: 'ms-trabajadores.js',   port: 7003, prefix: ['/trabajador', '/especialidad', '/presentismo'] },
  { name: 'ms-obra.js',           port: 7004, prefix: ['/obra', '/dashboard'] },
  { name: 'ms-labores.js',        port: 7005, prefix: ['/labor'] },
  { name: 'ms-estado.js',         port: 7006, prefix: ['/estado'] },
  { name: 'ms-materiales.js',     port: 7007, prefix: ['/materiales', '/tipoMaterial', '/historial', '/presupuestos', '/presupuestoMateriales'] },
  { name: 'ms-pagos.js',          port: 7008, prefix: ['/pagos', '/formasPago'] },
  { name: 'ms-notificaciones.js', port: 7009, prefix: ['/notificaciones'] },
  { name: 'ms-clientes.js',       port: 7010, prefix: ['/clientes'] },
];

// 1. Spawnear microservicios
services.forEach(service => {
  const servicePath = path.join(__dirname, 'microservices', service.name);
  const child = spawn('node', [servicePath], {
    env: { ...process.env, MS_PORT: service.port },
    stdio: 'inherit',
    shell: true,
  });
  child.on('close', code => console.log(`✅ ${service.name} cerró con código ${code}`));
  child.on('error', err => console.error(`❌ Error al iniciar ${service.name}:`, err));
});

// 2. Gateway
const app = express();

// CORS
const ALLOWED_ORIGINS = [
  'https://edifai-eight.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.includes('localhost'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// LOG — para debuggear, sacar después
app.use((req, res, next) => {
  console.log(`GATEWAY → ${req.method} ${req.url}`);
  next();
});

// 3. Proxy
services.forEach(service => {
  service.prefix.forEach(prefix => {
    app.use(prefix, createProxyMiddleware({
      target: `http://localhost:${service.port}`,
      changeOrigin: true,
      pathRewrite: (path) => prefix + path,
    }));
  });
});

app.get('/health', (_req, res) => res.json({ status: 'ok', gateway: true }));

app.listen(GATEWAY_PORT, () => {
  console.log(`🚀 Gateway corriendo en puerto ${GATEWAY_PORT}`);
});