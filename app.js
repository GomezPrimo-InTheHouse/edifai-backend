// const { spawn } = require('child_process');
// const path = require('path');

// //aca voy agregando los microservicios que quiero iniciar
// // cada uno con su nombre y puerto correspondiente
// // el nombre debe ser el mismo que el archivo del microservicio
// const services = [
//   { name: 'ms-auth.js', port: 7001 },
//   { name: 'ms-usuario.js', port: 7002 },
//   { name: 'ms-trabajadores.js', port: 7003 },
//   { name: 'ms-obra.js', port: 7004 },
//   { name: 'ms-labores.js', port: 7005 },
//   { name: 'ms-estado.js', port: 7006 },
//   { name: 'ms-materiales.js', port: 7007 },
//   { name: 'ms-pagos.js', port: 7008 },
//   { name: 'ms-notificaciones.js', port: 7009 },
//   { name: 'ms-clientes.js', port: 7010 },

// ];

// services.forEach(service => {
//   const servicePath = path.join(__dirname, 'microservices', service.name);

//   const child = spawn('node', [servicePath], {
//     env: { ...process.env, PORT: service.port },
//     stdio: 'inherit',
//     shell: true
//   });

//   child.on('close', code => {
//     console.log(`✅ ${service.name} finalizó con código ${code}`);
//   });

//   child.on('error', err => {
//     console.error(`❌ Error al iniciar ${service.name}:`, err);
//   });
// });

const { spawn } = require('child_process');
const path = require('path');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const GATEWAY_PORT = process.env.PORT || 3000;

const services = [
  { name: 'ms-auth.js',          port: 7001, prefix: '/auth' },
  { name: 'ms-usuario.js',       port: 7002, prefix: ['/usuario', '/usuario-rol'] },
  { name: 'ms-trabajadores.js',  port: 7003, prefix: ['/trabajador', '/especialidad', '/presentismo'] },
  { name: 'ms-obra.js',          port: 7004, prefix: ['/obra', '/dashboard'] },
  { name: 'ms-labores.js',       port: 7005, prefix: '/labor' },
  { name: 'ms-estado.js',        port: 7006, prefix: '/estado' },
  { name: 'ms-materiales.js',    port: 7007, prefix: ['/materiales', '/tipoMaterial', '/historial', '/presupuestos', '/presupuestoMateriales'] },
  { name: 'ms-pagos.js',         port: 7008, prefix: ['/pagos', '/formasPago'] },
  { name: 'ms-notificaciones.js',port: 7009, prefix: '/notificaciones' },
  { name: 'ms-clientes.js',      port: 7010, prefix: '/clientes' },
];

// 1. Spawnear todos los microservicios
services.forEach(service => {
  const servicePath = path.join(__dirname, 'microservices', service.name);
  const child = spawn('node', [servicePath], {
    env: { ...process.env, PORT: service.port },
    stdio: 'inherit',
    shell: true,
  });
  child.on('close', code => console.log(`✅ ${service.name} finalizó con código ${code}`));
  child.on('error', err => console.error(`❌ Error al iniciar ${service.name}:`, err));
});

// 2. Gateway Express en puerto 3000
const app = express();

// permitir vercel y otros servicios externos (si es necesario)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173' || 'https://edifai-frontend.vercel.app'; ;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// 3. Registrar rutas proxy
services.forEach(service => {
  const prefixes = Array.isArray(service.prefix) ? service.prefix : [service.prefix];
  prefixes.forEach(prefix => {
    app.use(prefix, createProxyMiddleware({
      target: `http://localhost:${service.port}`,
      changeOrigin: true,
    }));
  });
});

app.get('/health', (_req, res) => res.json({ status: 'ok', gateway: true }));

app.listen(GATEWAY_PORT, () => {
  console.log(`🚀 Gateway corriendo en puerto ${GATEWAY_PORT}`);
});